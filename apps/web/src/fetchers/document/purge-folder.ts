import { client } from "@kaneo/libs";

async function purgeFolder(id: string) {
  const response = await client.document.folders[":id"].purge.$delete({
    param: { id },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default purgeFolder;
