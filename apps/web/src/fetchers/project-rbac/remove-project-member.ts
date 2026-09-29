import { client } from "@kaneo/libs";

async function removeProjectMember(projectId: string, memberId: string) {
  const response = await client["project-rbac"][":projectId"].members[
    ":memberId"
  ].$delete({
    param: { projectId, memberId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default removeProjectMember;
