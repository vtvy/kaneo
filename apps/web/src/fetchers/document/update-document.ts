import { client } from "@kaneo/libs";

async function updateDocument(
  id: string,
  data: { name?: string; folderId?: string | null },
) {
  const response = await client.document[":id"].$put({
    param: { id },
    json: data,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default updateDocument;
