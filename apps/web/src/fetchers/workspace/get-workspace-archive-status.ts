import { client } from "@kaneo/libs";

async function getWorkspaceArchiveStatus(workspaceId: string) {
  const response = await client.workspace[":workspaceId"][
    "archive-status"
  ].$get({ param: { workspaceId } });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export default getWorkspaceArchiveStatus;
