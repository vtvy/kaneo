import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type GetSprintsByProjectRequest = InferRequestType<
  (typeof client)["sprint"]["project"][":projectId"]["$get"]
>["param"];

async function getSprintsByProject({ projectId }: GetSprintsByProjectRequest) {
  const response = await client.sprint.project[":projectId"].$get({
    param: { projectId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return await response.json();
}

export default getSprintsByProject;
