import { HTTPException } from "hono/http-exception";
import type { StorageObject } from "../../storage";
import { storage } from "../../storage";
import * as drive from "../drive/client";
import {
  getClientCreds,
  getDriveIntegration,
  getDriveIntegrationRow,
  getRefreshToken,
} from "../drive/config";

// Source-aware document storage. Server documents use the
// filesystem adapter; google_drive documents go through the Drive REST client
// using the project's stored connection. The fs path is always the default.

export type DocLike = {
  source: string;
  storageKey: string | null;
  externalId: string | null;
  driveManaged?: boolean;
  projectId: string;
};

async function tokenForProject(projectId: string): Promise<string> {
  const integration = await getDriveIntegration(projectId);
  if (!integration) {
    throw new HTTPException(400, {
      message: "Google Drive is not connected for this project",
    });
  }
  return drive.getAccessToken(
    getClientCreds(integration.config),
    getRefreshToken(integration.config),
  );
}

export async function getDocumentStream(doc: DocLike): Promise<StorageObject> {
  if (doc.source === "google_drive") {
    if (!doc.externalId) {
      throw new HTTPException(500, {
        message: "Drive document is missing its file id",
      });
    }
    const token = await tokenForProject(doc.projectId);
    const integration = await getDriveIntegration(doc.projectId);
    if (!integration?.config.rootFolderId)
      throw new HTTPException(403, { message: "Select a Drive folder first" });
    await assertFileWithinRoot(
      token,
      doc.externalId,
      integration.config.rootFolderId,
    );
    const { body, contentLength } = await drive.streamFile(
      token,
      doc.externalId,
    );
    return { body, contentLength };
  }
  if (!doc.storageKey) {
    throw new HTTPException(500, {
      message: "Server document is missing its storage key",
    });
  }
  return storage.get(doc.storageKey);
}

// Best-effort blob removal. Linked Drive files (driveManaged=false) are only
// unlinked — the file stays in Drive. The DB row is the source of truth.
export async function deleteDocumentBlob(doc: DocLike): Promise<void> {
  try {
    const remove = await prepareDocumentBlobDeletion(doc);
    await remove();
  } catch {
    console.error("Failed to delete document blob", {
      projectId: doc.projectId,
    });
  }
}

export type DriveUploadResult = {
  externalId: string;
  externalUrl: string | null;
  name: string;
  size: number;
  contentType: string;
};

// Uploads a file into the project's Drive root folder.
export async function uploadToDrive(
  projectId: string,
  file: File,
): Promise<DriveUploadResult> {
  const integration = await getDriveIntegration(projectId);
  if (!integration) {
    throw new HTTPException(400, {
      message: "Google Drive is not connected for this project",
    });
  }
  if (!integration.config.rootFolderId) {
    throw new HTTPException(400, {
      message: "Select a Google Drive folder for this project first",
    });
  }
  const token = await drive.getAccessToken(
    getClientCreds(integration.config),
    getRefreshToken(integration.config),
  );
  const buffer = Buffer.from(await file.arrayBuffer());
  const contentType = file.type || "application/octet-stream";
  const created = await drive.uploadFile(
    token,
    integration.config.rootFolderId,
    buffer,
    file.name,
    contentType,
  );
  return {
    externalId: created.id,
    externalUrl: safeDriveUrl(created.webViewLink),
    name: created.name || file.name,
    size: file.size,
    contentType: created.mimeType || contentType,
  };
}

export type DriveLinkResult = {
  externalId: string;
  externalUrl: string | null;
  name: string;
  size: number;
  contentType: string;
};

// Resolves metadata for an existing Drive file to link into the tree.
export async function resolveDriveFileForLink(
  projectId: string,
  driveFileId: string,
): Promise<DriveLinkResult> {
  const token = await tokenForProject(projectId);
  const integration = await getDriveIntegration(projectId);
  if (!integration?.config.rootFolderId)
    throw new HTTPException(400, {
      message: "Select a Google Drive folder first",
    });
  const meta = await assertFileWithinRoot(
    token,
    driveFileId,
    integration.config.rootFolderId,
  );
  if (
    meta.mimeType === drive.DRIVE_FOLDER_MIME ||
    meta.mimeType === "application/vnd.google-apps.shortcut"
  )
    throw new HTTPException(400, {
      message: "Select a file, not a folder or shortcut",
    });
  return {
    externalId: meta.id,
    externalUrl: safeDriveUrl(meta.webViewLink),
    name: meta.name,
    size: meta.size ? Number(meta.size) : 0,
    contentType: meta.mimeType.startsWith("application/vnd.google-apps.")
      ? "application/pdf"
      : meta.mimeType || "application/octet-stream",
  };
}

// Lists files + folders in a project's Drive (defaults to the root folder).
export async function listProjectDriveFiles(
  projectId: string,
  folderId?: string,
) {
  const integration = await getDriveIntegration(projectId);
  if (!integration) {
    throw new HTTPException(400, {
      message: "Google Drive is not connected for this project",
    });
  }
  const parent = folderId || integration.config.rootFolderId;
  if (!parent) {
    throw new HTTPException(400, {
      message: "Select a Google Drive folder for this project first",
    });
  }
  const token = await drive.getAccessToken(
    getClientCreds(integration.config),
    getRefreshToken(integration.config),
  );
  if (!integration.config.rootFolderId)
    throw new HTTPException(400, {
      message: "Select a Google Drive folder first",
    });
  const folder = await assertFileWithinRoot(
    token,
    parent,
    integration.config.rootFolderId,
  );
  if (folder.mimeType !== drive.DRIVE_FOLDER_MIME)
    throw new HTTPException(400, { message: "Not a folder" });
  return drive.listFiles(token, parent);
}

/** Capture encrypted integration state before a cascade removes its row. */
export async function prepareDocumentBlobDeletion(
  doc: DocLike,
): Promise<() => Promise<void>> {
  if (doc.source !== "google_drive")
    return () =>
      doc.storageKey ? storage.delete(doc.storageKey) : Promise.resolve();
  if (!doc.driveManaged || !doc.externalId) return async () => {};
  const integration = await getDriveIntegrationRow(doc.projectId);
  if (!integration) return async () => {};
  const creds = getClientCreds(integration.config);
  const refreshToken = getRefreshToken(integration.config);
  const externalId = doc.externalId;
  return async () => {
    const token = await drive.getAccessToken(creds, refreshToken);
    await drive.deleteFile(token, externalId);
  };
}
export function safeDriveUrl(raw?: string): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" &&
      ["drive.google.com", "docs.google.com"].includes(url.hostname) &&
      !url.username &&
      !url.password
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}
/** Never expose siblings elsewhere in the account through the shared token. */
export async function assertFileWithinRoot(
  token: string,
  id: string,
  rootId: string,
): Promise<drive.DriveFile> {
  drive.assertDriveId(id);
  drive.assertDriveId(rootId);
  const original = await drive.getFileMeta(token, id);
  let current = original;
  const visited = new Set<string>();
  for (let depth = 0; depth < 50; depth++) {
    if (current.id === rootId) return original;
    if (visited.has(current.id)) break;
    visited.add(current.id);
    const parent = current.parents?.[0];
    if (!parent) break;
    current = await drive.getFileMeta(token, parent);
  }
  throw new HTTPException(403, {
    message: "File is outside the project's Google Drive folder",
  });
}
