import { client } from "@kaneo/libs";

async function banAdminUser(userId: string, reason?: string) {
  const response = await client.admin.users[":userId"].ban.$post({
    param: { userId },
    json: reason ? { reason } : {},
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export default banAdminUser;
