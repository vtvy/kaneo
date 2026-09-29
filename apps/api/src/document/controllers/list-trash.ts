import { and, desc, eq, isNotNull } from "drizzle-orm";
import db from "../../database";
import { documentTable, folderTable, userTable } from "../../database/schema";

// Returns the "roots" of a project's Trash: trashed folders/documents whose
// container is NOT itself trashed. A trashed item nested inside a trashed folder
// is hidden here — it travels with its folder (restored/purged together).
async function listTrash(projectId: string) {
  const allFolders = await db
    .select({
      id: folderTable.id,
      parentId: folderTable.parentId,
      name: folderTable.name,
      deletedAt: folderTable.deletedAt,
      deletedBy: folderTable.deletedBy,
      deletedByName: userTable.name,
      deletedByEmail: userTable.email,
    })
    .from(folderTable)
    .leftJoin(userTable, eq(folderTable.deletedBy, userTable.id))
    .where(eq(folderTable.projectId, projectId));

  const deletedFolderIds = new Set(
    allFolders.filter((f) => f.deletedAt).map((f) => f.id),
  );

  const folders = allFolders
    .filter(
      (f) => f.deletedAt && (!f.parentId || !deletedFolderIds.has(f.parentId)),
    )
    .map((f) => ({
      id: f.id,
      name: f.name,
      deletedAt: f.deletedAt,
      deletedBy: f.deletedBy,
      deletedByName: f.deletedByName,
      deletedByEmail: f.deletedByEmail,
    }))
    .sort(
      (a, b) => (b.deletedAt?.getTime() ?? 0) - (a.deletedAt?.getTime() ?? 0),
    );

  const trashedDocs = await db
    .select({
      id: documentTable.id,
      folderId: documentTable.folderId,
      name: documentTable.name,
      size: documentTable.size,
      contentType: documentTable.contentType,
      deletedAt: documentTable.deletedAt,
      deletedBy: documentTable.deletedBy,
      deletedByName: userTable.name,
      deletedByEmail: userTable.email,
    })
    .from(documentTable)
    .leftJoin(userTable, eq(documentTable.deletedBy, userTable.id))
    .where(
      and(
        eq(documentTable.projectId, projectId),
        isNotNull(documentTable.deletedAt),
      ),
    )
    .orderBy(desc(documentTable.deletedAt));

  const documents = trashedDocs
    .filter((d) => !d.folderId || !deletedFolderIds.has(d.folderId))
    .map((d) => ({
      id: d.id,
      name: d.name,
      size: d.size,
      contentType: d.contentType,
      deletedAt: d.deletedAt,
      deletedBy: d.deletedBy,
      deletedByName: d.deletedByName,
      deletedByEmail: d.deletedByEmail,
    }));

  return { folders, documents };
}

export default listTrash;
