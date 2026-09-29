import { client } from "@kaneo/libs";

async function updateFolder(
  id: string,
  data: { name?: string; parentId?: string | null },
) {
  const response = await client.document.folders[":id"].$put({
    param: { id },
    json: data,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default updateFolder;
