import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type GetBacklogTasksRequest = InferRequestType<
  (typeof client)["sprint"]["project"][":projectId"]["backlog"]["$get"]
>["param"];

async function getBacklogTasks({ projectId }: GetBacklogTasksRequest) {
  const response = await client.sprint.project[":projectId"].backlog.$get({
    param: { projectId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return await response.json();
}

export default getBacklogTasks;
