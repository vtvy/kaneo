import { client } from "@kaneo/libs";

async function restoreFolder(id: string) {
  const response = await client.document.folders[":id"].restore.$post({
    param: { id },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default restoreFolder;
