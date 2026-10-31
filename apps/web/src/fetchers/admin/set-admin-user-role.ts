import { client } from "@kaneo/libs";

async function setAdminUserRole(userId: string, role: "admin" | "user") {
  const response = await client.admin.users[":userId"].role.$patch({
    param: { userId },
    json: { role },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export default setAdminUserRole;
