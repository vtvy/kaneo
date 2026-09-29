import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type CompleteSprintRequest = InferRequestType<
  (typeof client)["sprint"][":id"]["complete"]["$post"]
>["param"] & {
  targetSprintId?: string | null;
};

async function completeSprint({ id, targetSprintId }: CompleteSprintRequest) {
  const response = await client.sprint[":id"].complete.$post({
    param: { id },
    json: { targetSprintId: targetSprintId ?? null },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return await response.json();
}

export default completeSprint;
