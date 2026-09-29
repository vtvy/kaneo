import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { documentTable, folderTable } from "../../database/schema";

// Restore a document from Trash. If its folder is still trashed or gone, reattach
// to the project root so the restored file is always visible (never orphaned
// inside a hidden container).
async function restoreDocument(id: string) {
  const [doc] = await db
    .select({ id: documentTable.id, folderId: documentTable.folderId })
    .from(documentTable)
    .where(eq(documentTable.id, id))
    .limit(1);
  if (!doc) {
    throw new HTTPException(404, { message: "Document not found" });
  }

  let folderId = doc.folderId;
  if (folderId) {
    const [folder] = await db
      .select({ id: folderTable.id, deletedAt: folderTable.deletedAt })
      .from(folderTable)
      .where(eq(folderTable.id, folderId))
      .limit(1);
    if (!folder || folder.deletedAt) {
      folderId = null; // parent gone/trashed → restore to root
    }
  }

  await db
    .update(documentTable)
    .set({ deletedAt: null, deletedBy: null, folderId })
    .where(eq(documentTable.id, id));

  return { success: true };
}

export default restoreDocument;
