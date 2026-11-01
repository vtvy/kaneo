import { client } from "@kaneo/libs";

export async function adminResponse<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}
export const listInstanceRoles = async () =>
  adminResponse<{
    roles: { id: string; name: string; permissions: string[] }[];
    assignments: { userId: string; roleId: string }[];
    permissions: string[];
  }>(await client.admin.roles.$get());
export type InstanceRoleList = Awaited<ReturnType<typeof listInstanceRoles>>;
export const saveInstanceRole = async (
  id: string | null,
  name: string,
  permissions: string[],
) => {
  const json = { name, permissions } as Parameters<
    typeof client.admin.roles.$post
  >[0]["json"];
  return adminResponse(
    id
      ? await client.admin.roles[":roleId"].$put({
          param: { roleId: id },
          json,
        })
      : await client.admin.roles.$post({ json }),
  );
};
export const removeInstanceRole = async (id: string) =>
  adminResponse(
    await client.admin.roles[":roleId"].$delete({ param: { roleId: id } }),
  );
export const assignInstanceRole = async (
  userId: string,
  roleId: string | null,
) =>
  adminResponse(
    await client.admin.users[":userId"]["instance-role"].$put({
      param: { userId },
      json: { roleId },
    }),
  );

export type InstanceWebhook = {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  categories: string[];
};
export const listInstanceWebhooks = async () =>
  adminResponse<{ webhooks: InstanceWebhook[]; categories: string[] }>(
    await client.admin.webhooks.$get(),
  );
export const saveInstanceWebhook = async (
  id: string | null,
  input: Omit<InstanceWebhook, "id">,
) => {
  const json = input as Parameters<
    typeof client.admin.webhooks.$post
  >[0]["json"];
  return adminResponse<{ secret?: string }>(
    id
      ? await client.admin.webhooks[":webhookId"].$put({
          param: { webhookId: id },
          json,
        })
      : await client.admin.webhooks.$post({ json }),
  );
};
export const removeInstanceWebhook = async (webhookId: string) =>
  adminResponse(
    await client.admin.webhooks[":webhookId"].$delete({ param: { webhookId } }),
  );
export const testInstanceWebhook = async (webhookId: string) =>
  adminResponse(
    await client.admin.webhooks[":webhookId"].test.$post({
      param: { webhookId },
    }),
  );
export const rotateInstanceWebhook = async (webhookId: string) =>
  adminResponse<{ secret: string }>(
    await client.admin.webhooks[":webhookId"]["rotate-secret"].$post({
      param: { webhookId },
    }),
  );
export const listInstanceWebhookDeliveries = async (webhookId: string) =>
  adminResponse<
    {
      id: string;
      state: string;
      attempts: number;
      statusCode: number | null;
      errorCode: string | null;
      createdAt: string;
    }[]
  >(
    await client.admin.webhooks[":webhookId"].deliveries.$get({
      param: { webhookId },
    }),
  );
