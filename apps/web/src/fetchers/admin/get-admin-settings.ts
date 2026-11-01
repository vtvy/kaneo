import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";

export type AdminSettings = InferResponseType<
  typeof client.admin.settings.$get,
  200
>;

async function getAdminSettings() {
  const response = await client.admin.settings.$get();

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export default getAdminSettings;
