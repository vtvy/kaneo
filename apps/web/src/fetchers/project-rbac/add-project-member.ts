import { client } from "@kaneo/libs";

async function addProjectMember(
  projectId: string,
  email: string,
  roleNames?: string[],
) {
  const response = await client["project-rbac"][":projectId"].members.$post({
    param: { projectId },
    json: { email, roleNames: roleNames ?? [] },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default addProjectMember;
