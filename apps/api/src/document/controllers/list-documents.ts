import { and, desc, eq, isNull } from "drizzle-orm";
import db from "../../database";
import { documentTable, userTable } from "../../database/schema";

// Lists active documents in a project folder (folderId null = project root),
// newest first, with the uploader's name/email for display. Trashed documents
// (deletedAt set) are excluded.
async function listDocuments(projectId: string, folderId: string | null) {
  return db
    .select({
      id: documentTable.id,
      projectId: documentTable.projectId,
      folderId: documentTable.folderId,
      name: documentTable.name,
      size: documentTable.size,
      contentType: documentTable.contentType,
      createdBy: documentTable.createdBy,
      createdByName: userTable.name,
      createdByEmail: userTable.email,
      createdAt: documentTable.createdAt,
      updatedAt: documentTable.updatedAt,
    })
    .from(documentTable)
    .leftJoin(userTable, eq(documentTable.createdBy, userTable.id))
    .where(
      and(
        eq(documentTable.projectId, projectId),
        isNull(documentTable.deletedAt),
        folderId === null
          ? isNull(documentTable.folderId)
          : eq(documentTable.folderId, folderId),
      ),
    )
    .orderBy(desc(documentTable.createdAt));
}

export default listDocuments;
