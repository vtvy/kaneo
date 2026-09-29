import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { documentTable } from "../../database/schema";

// Soft-delete: move the document to Trash. The blob stays on disk and the row
// is kept — only `deletedAt`/`deletedBy` are stamped. Restorable until purged.
async function trashDocument(id: string, currentUserId: string) {
  const [doc] = await db
    .select({ id: documentTable.id })
    .from(documentTable)
    .where(eq(documentTable.id, id))
    .limit(1);
  if (!doc) {
    throw new HTTPException(404, { message: "Document not found" });
  }

  await db
    .update(documentTable)
    .set({ deletedAt: new Date(), deletedBy: currentUserId || null })
    .where(eq(documentTable.id, id));

  return { success: true };
}

export default trashDocument;
