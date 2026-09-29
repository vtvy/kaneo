import { client } from "@kaneo/libs";

async function createFolder(
  projectId: string,
  name: string,
  parentId: string | null,
) {
  const response = await client.document.folders[":projectId"].$post({
    param: { projectId },
    json: { name, parentId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default createFolder;
