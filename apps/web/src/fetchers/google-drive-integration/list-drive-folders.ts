import { client } from "@kaneo/libs";

async function listDriveFolders(projectId: string, parentId?: string) {
  const response = await client["google-drive-integration"].project[
    ":projectId"
  ].folders.$get({
    param: { projectId },
    query: parentId ? { parentId } : {},
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export default listDriveFolders;
