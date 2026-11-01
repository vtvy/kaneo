import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";

export type AdminSystemStatus = InferResponseType<
  typeof client.admin.system.$get,
  200
>;

async function getAdminSystemStatus() {
  const response = await client.admin.system.$get();

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export default getAdminSystemStatus;
