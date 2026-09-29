import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type AssignTaskToSprintRequest = InferRequestType<
  (typeof client)["sprint"][":id"]["task"]["$post"]
>["json"] &
  InferRequestType<(typeof client)["sprint"][":id"]["task"]["$post"]>["param"];

async function assignTaskToSprint({ id, taskId }: AssignTaskToSprintRequest) {
  const response = await client.sprint[":id"].task.$post({
    param: { id },
    json: { taskId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return await response.json();
}

export default assignTaskToSprint;
