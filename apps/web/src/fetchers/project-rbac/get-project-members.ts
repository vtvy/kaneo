import { client } from "@kaneo/libs";

async function getProjectMembers(projectId: string) {
  const response = await client["project-rbac"][":projectId"].members.$get({
    param: { projectId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default getProjectMembers;
