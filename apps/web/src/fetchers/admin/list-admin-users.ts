import { client } from "@kaneo/libs";
import type { InferRequestType, InferResponseType } from "hono/client";

export type ListAdminUsersQuery = InferRequestType<
  typeof client.admin.users.$get
>["query"];

export type AdminUsersResponse = InferResponseType<
  typeof client.admin.users.$get,
  200
>;

export type AdminUser = AdminUsersResponse["users"][number];

async function listAdminUsers(query: ListAdminUsersQuery) {
  const response = await client.admin.users.$get({ query });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export default listAdminUsers;
