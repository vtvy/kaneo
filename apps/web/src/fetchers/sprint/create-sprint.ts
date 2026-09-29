import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type CreateSprintRequest = InferRequestType<
  (typeof client)["sprint"]["$post"]
>["json"];

async function createSprint({
  projectId,
  name,
  goal,
  startDate,
  endDate,
}: CreateSprintRequest) {
  const response = await client.sprint.$post({
    json: {
      projectId,
      name,
      goal,
      startDate,
      endDate,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return await response.json();
}

export default createSprint;
