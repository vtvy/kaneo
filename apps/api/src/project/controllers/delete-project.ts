import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { projectTable } from "../../database/schema";
import {
  cleanupContainerStorage,
  collectContainerStorage,
} from "../../storage/cleanup-container";
import { deleteS3Object } from "../../storage/s3";
import getProject from "./get-project";

async function deleteProject(id: string, workspaceId: string) {
  const existingProject = await getProject(id, workspaceId);

  const { deletedProject, capturedStorage } = await db.transaction(
    async (tx) => {
      // Block new child rows while taking the snapshot for blob cleanup.
      const [locked] = await tx
        .select({ id: projectTable.id })
        .from(projectTable)
        .where(
          and(
            eq(projectTable.id, id),
            eq(projectTable.workspaceId, workspaceId),
          ),
        )
        .for("update");
      if (!locked)
        throw new HTTPException(404, { message: "Project not found" });
      const capturedStorage = await collectContainerStorage(tx, {
        projectId: id,
      });
      const [deletedProject] = await tx
        .delete(projectTable)
        .where(eq(projectTable.id, id))
        .returning();
      return { deletedProject, capturedStorage };
    },
  );

  if (!deletedProject) {
    throw new HTTPException(500, {
      message: "Failed to delete project",
    });
  }

  await cleanupContainerStorage(capturedStorage);
  if (existingProject.backgroundObjectKey) {
    deleteS3Object(existingProject.backgroundObjectKey).catch(() => {});
  }
  return existingProject;
}

export default deleteProject;
