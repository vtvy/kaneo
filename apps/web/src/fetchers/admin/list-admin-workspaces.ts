import { client } from "@kaneo/libs";
import type { InferRequestType, InferResponseType } from "hono/client";

export type ListAdminWorkspacesQuery = InferRequestType<
  typeof client.admin.workspaces.$get
>["query"];

export type AdminWorkspace = InferResponseType<
  typeof client.admin.workspaces.$get,
  200
>["workspaces"][number];

async function listAdminWorkspaces(query: ListAdminWorkspacesQuery) {
  const response = await client.admin.workspaces.$get({ query });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export default listAdminWorkspaces;
