import { client } from "@kaneo/libs";

async function unbanAdminUser(userId: string) {
  const response = await client.admin.users[":userId"].unban.$post({
    param: { userId },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export default unbanAdminUser;
