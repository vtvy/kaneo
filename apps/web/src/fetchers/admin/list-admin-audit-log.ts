import { client } from "@kaneo/libs";
import type { InferRequestType, InferResponseType } from "hono/client";

export type ListAdminAuditLogQuery = InferRequestType<
  (typeof client.admin)["audit-log"]["$get"]
>["query"];

export type AdminAuditEntry = InferResponseType<
  (typeof client.admin)["audit-log"]["$get"],
  200
>["entries"][number];

async function listAdminAuditLog(query: ListAdminAuditLogQuery) {
  const response = await client.admin["audit-log"].$get({ query });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export default listAdminAuditLog;
