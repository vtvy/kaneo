import { client } from "@kaneo/libs";

async function setAdminWorkspaceArchived(
  workspaceId: string,
  archived: boolean,
) {
  const route = client.admin.workspaces[":workspaceId"];
  const response = archived
    ? await route.archive.$post({ param: { workspaceId } })
    : await route.unarchive.$post({ param: { workspaceId } });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export default setAdminWorkspaceArchived;
