import { client } from "@kaneo/libs";

export type MyTasksScope = "assigned" | "involved";

async function getMyTasks(
  workspaceId: string,
  scope: MyTasksScope = "assigned",
) {
  const response = await client.task.my[":workspaceId"].$get({
    param: { workspaceId },
    query: { scope },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();

  return data;
}

export default getMyTasks;
