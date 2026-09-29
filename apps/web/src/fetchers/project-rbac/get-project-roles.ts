import { client } from "@kaneo/libs";

async function getProjectRoles(projectId: string) {
  const response = await client["project-rbac"][":projectId"].roles.$get({
    param: { projectId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default getProjectRoles;
