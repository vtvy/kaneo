import { client } from "@kaneo/libs";

async function listDriveFiles(projectId: string, folderId?: string) {
  const response = await client.document.drive[":projectId"].$get({
    param: { projectId },
    query: folderId ? { folderId } : {},
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export default listDriveFiles;
