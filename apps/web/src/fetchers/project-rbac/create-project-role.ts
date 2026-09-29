import { client } from "@kaneo/libs";

async function createProjectRole(
  projectId: string,
  name: string,
  permissions: Record<string, string[]>,
) {
  const response = await client["project-rbac"][":projectId"].roles.$post({
    param: { projectId },
    json: { name, permissions },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default createProjectRole;
