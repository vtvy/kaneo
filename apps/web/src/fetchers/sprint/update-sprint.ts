import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type UpdateSprintRequest = InferRequestType<
  (typeof client)["sprint"][":id"]["$put"]
>["json"] &
  InferRequestType<(typeof client)["sprint"][":id"]["$put"]>["param"];

async function updateSprint({
  id,
  name,
  goal,
  startDate,
  endDate,
}: UpdateSprintRequest) {
  const response = await client.sprint[":id"].$put({
    param: { id },
    json: { name, goal, startDate, endDate },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return await response.json();
}

export default updateSprint;
