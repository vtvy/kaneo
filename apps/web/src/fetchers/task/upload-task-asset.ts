import { resolveApiBaseUrl, windowId } from "@kaneo/libs";

// Direct multipart upload to POST /api/task/asset/:taskId.
// We use a plain fetch (not the hc client) because the hc client hardcodes
// `Content-Type: application/json`, which breaks multipart — the browser must
// set the multipart boundary itself. Credentials + window-id header match the
// authed request convention used elsewhere in the app.
const API_BASE = resolveApiBaseUrl(import.meta.env.VITE_API_URL);

export async function uploadTaskAsset({
  taskId,
  file,
  surface,
}: {
  taskId: string;
  file: File;
  surface: "description" | "comment";
}): Promise<{ id: string; url: string }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("surface", surface);

  const url = `${API_BASE}/task/asset/${encodeURIComponent(taskId)}`;

  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: {
      "X-Kaneo-Window-Id": windowId,
    },
    // Do NOT set Content-Type — the browser adds the multipart boundary.
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Failed to upload file to storage.");
  }

  return response.json();
}

export default uploadTaskAsset;
