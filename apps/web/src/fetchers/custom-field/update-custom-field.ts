import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type UpdateCustomFieldRequest = InferRequestType<
  (typeof client)["custom-field"][":id"]["$put"]
>["json"];

async function updateCustomField(id: string, json: UpdateCustomFieldRequest) {
  const response = await client["custom-field"][":id"].$put({
    param: { id },
    json,
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export default updateCustomField;
