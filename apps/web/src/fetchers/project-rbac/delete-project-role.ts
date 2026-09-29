import { client } from "@kaneo/libs";

async function deleteProjectRole(projectId: string, roleId: string) {
  const response = await client["project-rbac"][":projectId"].roles[
    ":roleId"
  ].$delete({
    param: { projectId, roleId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default deleteProjectRole;
