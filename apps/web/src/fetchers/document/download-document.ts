import { resolveApiBaseUrl } from "@kaneo/libs";

// Downloads use a raw fetch so the auth cookie is sent and the binary is read
// as a blob (a plain anchor href to a cross-origin API would not carry creds).
const API_BASE = resolveApiBaseUrl(import.meta.env.VITE_API_URL);

async function downloadDocument(id: string, filename: string) {
  const response = await fetch(`${API_BASE}/document/${id}/download`, {
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Download failed");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  window.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default downloadDocument;
