import { resolveApiBaseUrl } from "@kaneo/libs";

// Fetches a document's bytes (authenticated) as a Blob for inline preview. The
// /download route sets Content-Disposition: attachment, but that is irrelevant
// when the body is read programmatically — we render it via an object URL.
const API_BASE = resolveApiBaseUrl(import.meta.env.VITE_API_URL);

async function fetchDocumentBlob(id: string): Promise<Blob> {
  const response = await fetch(`${API_BASE}/document/${id}/download`, {
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Failed to load document");
  }

  return response.blob();
}

export default fetchDocumentBlob;
