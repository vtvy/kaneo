import { client } from "@kaneo/libs";

async function purgeDocument(id: string) {
  const response = await client.document[":id"].purge.$delete({
    param: { id },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default purgeDocument;
