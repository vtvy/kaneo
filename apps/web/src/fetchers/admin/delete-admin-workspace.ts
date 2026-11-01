import { client } from "@kaneo/libs";

async function deleteAdminWorkspace(workspaceId: string, confirmName: string) {
  const response = await client.admin.workspaces[":workspaceId"].$delete({
    param: { workspaceId },
    json: { confirmName },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export default deleteAdminWorkspace;
