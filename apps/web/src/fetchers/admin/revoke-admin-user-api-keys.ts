import { client } from "@kaneo/libs";

/** Revokes one API key when `keyId` is given, otherwise all of them. */
async function revokeAdminUserApiKeys(userId: string, keyId?: string) {
  const response = keyId
    ? await client.admin.users[":userId"]["api-keys"][":keyId"].$delete({
        param: { userId, keyId },
      })
    : await client.admin.users[":userId"]["api-keys"].$delete({
        param: { userId },
      });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export default revokeAdminUserApiKeys;
