import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { folderTable } from "../../database/schema";

// Restore a folder from Trash. If its parent is still trashed or gone, reattach
// to the project root so the restored folder (and its contents) are visible.
async function restoreFolder(id: string) {
  const [folder] = await db
    .select({ id: folderTable.id, parentId: folderTable.parentId })
    .from(folderTable)
    .where(eq(folderTable.id, id))
    .limit(1);
  if (!folder) {
    throw new HTTPException(404, { message: "Folder not found" });
  }

  let parentId = folder.parentId;
  if (parentId) {
    const [parent] = await db
      .select({ id: folderTable.id, deletedAt: folderTable.deletedAt })
      .from(folderTable)
      .where(eq(folderTable.id, parentId))
      .limit(1);
    if (!parent || parent.deletedAt) {
      parentId = null; // parent gone/trashed → restore to root
    }
  }

  await db
    .update(folderTable)
    .set({ deletedAt: null, deletedBy: null, parentId })
    .where(eq(folderTable.id, id));

  return { success: true };
}

export default restoreFolder;
