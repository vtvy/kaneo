import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";

export type AdminUserSession = InferResponseType<
  (typeof client.admin.users)[":userId"]["sessions"]["$get"],
  200
>[number];

async function listAdminUserSessions(userId: string) {
  const response = await client.admin.users[":userId"].sessions.$get({
    param: { userId },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export default listAdminUserSessions;
