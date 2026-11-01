import { client } from "@kaneo/libs";

async function reorderCustomFields(
  projectId: string,
  fields: Array<{ id: string; position: number }>,
) {
  const response = await client["custom-field"].reorder[":projectId"].$put({
    param: { projectId },
    json: { fields },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export default reorderCustomFields;
