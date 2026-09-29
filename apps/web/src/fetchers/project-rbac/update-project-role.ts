import { client } from "@kaneo/libs";

async function updateProjectRole(
  projectId: string,
  roleId: string,
  data: { name?: string; permissions?: Record<string, string[]> },
) {
  const response = await client["project-rbac"][":projectId"].roles[
    ":roleId"
  ].$put({
    param: { projectId, roleId },
    json: data,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default updateProjectRole;
