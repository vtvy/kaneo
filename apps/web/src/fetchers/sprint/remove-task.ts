import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type RemoveTaskFromSprintRequest = InferRequestType<
  (typeof client)["sprint"][":id"]["task"]["$delete"]
>["json"] &
  InferRequestType<
    (typeof client)["sprint"][":id"]["task"]["$delete"]
  >["param"];

async function removeTaskFromSprint({
  id,
  taskId,
}: RemoveTaskFromSprintRequest) {
  const response = await client.sprint[":id"].task.$delete({
    param: { id },
    json: { taskId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return await response.json();
}

export default removeTaskFromSprint;
