import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";

export type MyTasksScope = "assigned" | "involved";

export type MyTask = InferResponseType<
  (typeof client)["task"]["my"][":workspaceId"]["$get"],
  200
>[number];

async function getMyTasks(
  workspaceId: string,
  scope: MyTasksScope = "assigned",
  options: { open?: boolean } = {},
) {
  const response = await client.task.my[":workspaceId"].$get({
    param: { workspaceId },
    query: options.open ? { scope, open: "true" } : { scope },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();

  return data;
}

export default getMyTasks;
