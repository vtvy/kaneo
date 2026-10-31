import { client } from "@kaneo/libs";

async function deleteAdminUser(userId: string) {
  const response = await client.admin.users[":userId"].$delete({
    param: { userId },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export default deleteAdminUser;
