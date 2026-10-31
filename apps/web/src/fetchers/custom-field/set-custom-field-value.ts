import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type SetCustomFieldValueRequest = InferRequestType<
  (typeof client)["custom-field"]["value"]["$put"]
>["json"];

async function setCustomFieldValue(json: SetCustomFieldValueRequest) {
  const response = await client["custom-field"].value.$put({ json });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export default setCustomFieldValue;
