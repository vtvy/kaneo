import { resolveApiBaseUrl, windowId } from "@kaneo/libs";

// Uploads use XMLHttpRequest (not fetch) for two reasons:
//  1. The hc client hardcodes `Content-Type: application/json`, which breaks
//     multipart — the browser must set the multipart boundary itself.
//  2. XHR exposes upload progress events; fetch does not. This lets large files
//     upload in the background with a progress indicator instead of freezing the UI.
const API_BASE = resolveApiBaseUrl(import.meta.env.VITE_API_URL);

function uploadDocument(
  projectId: string,
  file: File,
  folderId: string | null,
  workspaceId: string,
  onProgress?: (percent: number) => void,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);
    if (folderId) {
      formData.append("folderId", folderId);
    }

    // Pass workspaceId as a query param: the server's workspaceAccess middleware
    // resolves it from the query first and skips its body-reading project lookup,
    // which would otherwise consume the multipart body before the upload handler.
    const url = `${API_BASE}/document/${projectId}?workspaceId=${encodeURIComponent(
      workspaceId,
    )}`;

    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.withCredentials = true;
    xhr.setRequestHeader("X-Kaneo-Window-Id", windowId);
    // Do NOT set Content-Type — the browser adds the multipart boundary.

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          resolve(null);
        }
      } else {
        reject(new Error(xhr.responseText || `Upload failed (${xhr.status})`));
      }
    });
    xhr.addEventListener("error", () => reject(new Error("Upload failed")));
    xhr.addEventListener("abort", () => reject(new Error("Upload cancelled")));

    xhr.send(formData);
  });
}

export default uploadDocument;
