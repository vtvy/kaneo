import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { documentTable, folderTable } from "../../database/schema";

// Rename and/or move a document between folders. Metadata only — the blob is
// never touched (same storageKey).
async function updateDocument({
  id,
  name,
  folderId,
}: {
  id: string;
  name?: string;
  folderId?: string | null;
}) {
  const [doc] = await db
    .select()
    .from(documentTable)
    .where(eq(documentTable.id, id))
    .limit(1);
  if (!doc) {
    throw new HTTPException(404, { message: "Document not found" });
  }

  const updates: { name?: string; folderId?: string | null } = {};

  if (name !== undefined) {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new HTTPException(400, { message: "Document name is required" });
    }
    updates.name = trimmed;
  }

  if (folderId !== undefined) {
    if (folderId !== null) {
      const [folder] = await db
        .select({ id: folderTable.id })
        .from(folderTable)
        .where(
          and(
            eq(folderTable.id, folderId),
            eq(folderTable.projectId, doc.projectId),
          ),
        )
        .limit(1);
      if (!folder) {
        throw new HTTPException(400, { message: "Folder not found" });
      }
    }
    updates.folderId = folderId;
  }

  if (Object.keys(updates).length === 0) {
    return doc;
  }

  const [updated] = await db
    .update(documentTable)
    .set(updates)
    .where(eq(documentTable.id, id))
    .returning();

  return updated;
}

export default updateDocument;
