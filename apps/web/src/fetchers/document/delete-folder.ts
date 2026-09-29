import { client } from "@kaneo/libs";

async function deleteFolder(id: string) {
  const response = await client.document.folders[":id"].$delete({
    param: { id },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default deleteFolder;
