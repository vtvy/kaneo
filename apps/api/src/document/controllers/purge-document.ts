import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { documentTable } from "../../database/schema";
import { storage } from "../../storage";

// Permanently removes the row and the blob (purge from Trash). The DB is the
// source of truth; blob deletion is best-effort.
async function purgeDocument(id: string) {
  const [doc] = await db
    .select({ id: documentTable.id, storageKey: documentTable.storageKey })
    .from(documentTable)
    .where(eq(documentTable.id, id))
    .limit(1);
  if (!doc) {
    throw new HTTPException(404, { message: "Document not found" });
  }

  await db.delete(documentTable).where(eq(documentTable.id, id));
  await storage.delete(doc.storageKey).catch(() => {});

  return { success: true };
}

export default purgeDocument;
