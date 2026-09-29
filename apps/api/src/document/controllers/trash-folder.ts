import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { folderTable } from "../../database/schema";

// Soft-delete: move the folder to Trash. Only this folder row is stamped;
// descendants stay unstamped but are hidden by the active-listing ancestor walk
// and travel with the folder (restored/purged together).
async function trashFolder(id: string, currentUserId: string) {
  const [folder] = await db
    .select({ id: folderTable.id })
    .from(folderTable)
    .where(eq(folderTable.id, id))
    .limit(1);
  if (!folder) {
    throw new HTTPException(404, { message: "Folder not found" });
  }

  await db
    .update(folderTable)
    .set({ deletedAt: new Date(), deletedBy: currentUserId || null })
    .where(eq(folderTable.id, id));

  return { success: true };
}

export default trashFolder;
