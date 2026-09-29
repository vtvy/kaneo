import { client } from "@kaneo/libs";

async function listDocuments(projectId: string, folderId: string | null) {
  const response = await client.document.list[":projectId"].$get({
    param: { projectId },
    query: folderId ? { folderId } : {},
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default listDocuments;
