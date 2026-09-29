import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type DeleteSprintRequest = InferRequestType<
  (typeof client)["sprint"][":id"]["$delete"]
>["param"];

async function deleteSprint({ id }: DeleteSprintRequest) {
  const response = await client.sprint[":id"].$delete({
    param: { id },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return await response.json();
}

export default deleteSprint;
