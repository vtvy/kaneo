import { client } from "@kaneo/libs";

async function emptyTrash(projectId: string) {
  const response = await client.document.trash[":projectId"].$delete({
    param: { projectId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default emptyTrash;
