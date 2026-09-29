import { client } from "@kaneo/libs";

async function assignMemberRoles(
  projectId: string,
  memberId: string,
  roleIds: string[],
) {
  const response = await client["project-rbac"][":projectId"].members[
    ":memberId"
  ].roles.$put({
    param: { projectId, memberId },
    json: { roleIds },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default assignMemberRoles;
