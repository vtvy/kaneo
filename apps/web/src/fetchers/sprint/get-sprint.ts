import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type GetSprintRequest = InferRequestType<
  (typeof client)["sprint"][":id"]["$get"]
>["param"];

async function getSprint({ id }: GetSprintRequest) {
  const response = await client.sprint[":id"].$get({
    param: { id },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return await response.json();
}

export default getSprint;
