import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type UpdateAdminSettingsRequest = InferRequestType<
  typeof client.admin.settings.$patch
>["json"];

async function updateAdminSettings(json: UpdateAdminSettingsRequest) {
  const response = await client.admin.settings.$patch({ json });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export default updateAdminSettings;
