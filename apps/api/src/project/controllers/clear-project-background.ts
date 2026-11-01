import { eq } from "drizzle-orm";
import db from "../../database";
import { projectTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { deleteS3Object } from "../../storage/s3";

async function clearProjectBackground(projectId: string) {
  const [currentProject] = await db
    .select({ backgroundObjectKey: projectTable.backgroundObjectKey })
    .from(projectTable)
    .where(eq(projectTable.id, projectId))
    .limit(1);

  const [updatedProject] = await db
    .update(projectTable)
    .set({
      backgroundObjectKey: null,
      backgroundMimeType: null,
      backgroundVersion: null,
    })
    .where(eq(projectTable.id, projectId))
    .returning({ id: projectTable.id });

  if (updatedProject && currentProject?.backgroundObjectKey) {
    deleteS3Object(currentProject.backgroundObjectKey).catch(() => {});
  }

  if (updatedProject) {
    await publishEvent("project.updated", { projectId });
  }
}

export default clearProjectBackground;
