import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type GetSprintTasksRequest = InferRequestType<
  (typeof client)["sprint"][":id"]["tasks"]["$get"]
>["param"];

async function getSprintTasks({ id }: GetSprintTasksRequest) {
  const response = await client.sprint[":id"].tasks.$get({
    param: { id },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return await response.json();
}

export default getSprintTasks;
