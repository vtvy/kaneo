import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type CreateCustomFieldRequest = InferRequestType<
  (typeof client)["custom-field"]["$post"]
>["json"];

async function createCustomField(json: CreateCustomFieldRequest) {
  const response = await client["custom-field"].$post({ json });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export default createCustomField;
