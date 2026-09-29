import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { folderTable } from "../../database/schema";

async function createFolder({
  projectId,
  name,
  parentId,
  currentUserId,
}: {
  projectId: string;
  name: string;
  parentId?: string | null;
  currentUserId: string;
}) {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new HTTPException(400, { message: "Folder name is required" });
  }

  // A parent must exist and belong to the same project.
  if (parentId) {
    const [parent] = await db
      .select({ id: folderTable.id })
      .from(folderTable)
      .where(
        and(eq(folderTable.id, parentId), eq(folderTable.projectId, projectId)),
      )
      .limit(1);
    if (!parent) {
      throw new HTTPException(400, { message: "Parent folder not found" });
    }
  }

  const [created] = await db
    .insert(folderTable)
    .values({
      projectId,
      name: trimmed,
      parentId: parentId ?? null,
      createdBy: currentUserId,
    })
    .returning();

  if (!created) {
    throw new HTTPException(500, { message: "Failed to create folder" });
  }

  return created;
}

export default createFolder;
