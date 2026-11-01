import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";

export type AdminUserApiKey = InferResponseType<
  (typeof client.admin.users)[":userId"]["api-keys"]["$get"],
  200
>[number];

async function listAdminUserApiKeys(userId: string) {
  const response = await client.admin.users[":userId"]["api-keys"].$get({
    param: { userId },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export default listAdminUserApiKeys;
