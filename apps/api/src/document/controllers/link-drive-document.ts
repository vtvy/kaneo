import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { documentTable, folderTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { resolveDriveFileForLink } from "../providers";

// Links an existing Google Drive file into the project's document tree. Stores
// only metadata + the Drive file id — content stays in Drive (driveManaged=false,
// so deleting the document unlinks it without removing the Drive file).
async function linkDriveDocument({
  projectId,
  folderId,
  driveFileId,
  currentUserId,
}: {
  projectId: string;
  folderId: string | null;
  driveFileId: string;
  currentUserId: string;
}) {
  if (folderId) {
    const [folder] = await db
      .select({ id: folderTable.id })
      .from(folderTable)
      .where(
        and(eq(folderTable.id, folderId), eq(folderTable.projectId, projectId)),
      )
      .limit(1);
    if (!folder) {
      throw new HTTPException(400, { message: "Folder not found" });
    }
  }

  const meta = await resolveDriveFileForLink(projectId, driveFileId);

  const [created] = await db
    .insert(documentTable)
    .values({
      projectId,
      folderId,
      name: meta.name,
      source: "google_drive",
      storageKey: null,
      externalId: meta.externalId,
      externalUrl: meta.externalUrl,
      driveManaged: false,
      size: meta.size,
      contentType: meta.contentType,
      createdBy: currentUserId,
    })
    .returning();

  if (!created) {
    throw new HTTPException(500, { message: "Failed to link document" });
  }

  await publishEvent("document.created", {
    documentId: created.id,
    projectId,
    currentUserId,
  });

  return created;
}

export default linkDriveDocument;
