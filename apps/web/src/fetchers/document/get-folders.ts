import { client } from "@kaneo/libs";

async function getFolders(projectId: string) {
  const response = await client.document.folders[":projectId"].$get({
    param: { projectId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default getFolders;
