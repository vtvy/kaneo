import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";

export type WorkspaceActivity = InferResponseType<
  (typeof client)["activity"]["workspace"][":workspaceId"]["$get"],
  200
>[number];

async function getWorkspaceActivities(workspaceId: string) {
  const response = await client.activity.workspace[":workspaceId"].$get({
    param: { workspaceId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default getWorkspaceActivities;
