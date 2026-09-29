import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { documentTable, folderTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { storage } from "../../storage";
import { buildDocumentKey } from "../../storage/build-document-key";

const MAX = Number(process.env.DOCUMENT_MAX_UPLOAD_BYTES ?? 50 * 1024 * 1024);

const EXTENSION_CONTENT_TYPES: Record<string, string> = {
  md: "text/markdown",
  markdown: "text/markdown",
  mdx: "text/markdown",
  txt: "text/plain",
  csv: "text/csv",
  json: "application/json",
  xml: "application/xml",
  yml: "application/yaml",
  yaml: "application/yaml",
};

function resolveContentType(file: File): string {
  const reported = file.type?.trim().toLowerCase() ?? "";
  if (
    reported &&
    reported !== "application/octet-stream" &&
    reported !== "binary/octet-stream"
  ) {
    return reported;
  }

  const name = file.name.trim().split(/[/\\]/).pop() ?? file.name;
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) {
    return reported || "application/octet-stream";
  }

  const ext = name.slice(dot + 1).toLowerCase();
  return (
    EXTENSION_CONTENT_TYPES[ext] ?? (reported || "application/octet-stream")
  );
}

// Upload-through-API: the filesystem driver has no presign, so the bytes flow
// through the API. Stream to disk via the storage adapter, then record a row.
async function uploadDocument({
  projectId,
  folderId,
  file,
  currentUserId,
}: {
  projectId: string;
  folderId: string | null;
  file: File;
  currentUserId: string;
}) {
  if (!file || file.size <= 0) {
    throw new HTTPException(400, { message: "Empty file" });
  }
  if (file.size > MAX) {
    throw new HTTPException(413, {
      message: `File exceeds ${Math.floor(MAX / 1048576)}MB limit`,
    });
  }

  // A target folder must exist and belong to the same project.
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

  const storageKey = buildDocumentKey(projectId, file.name);
  const buf = Buffer.from(await file.arrayBuffer());
  const contentType = resolveContentType(file);
  await storage.put(storageKey, buf, contentType);

  const [created] = await db
    .insert(documentTable)
    .values({
      projectId,
      folderId,
      name: file.name,
      storageKey,
      size: file.size,
      contentType,
      createdBy: currentUserId,
    })
    .returning();

  if (!created) {
    await storage.delete(storageKey).catch(() => {}); // roll back the blob
    throw new HTTPException(500, { message: "Failed to record document" });
  }

  await publishEvent("document.created", {
    documentId: created.id,
    projectId,
    currentUserId,
  });

  return created;
}

export default uploadDocument;
