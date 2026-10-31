import { client } from "@kaneo/libs";

async function deleteCustomField({ id }: { id: string }) {
  const response = await client["custom-field"][":id"].$delete({
    param: { id },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export default deleteCustomField;
