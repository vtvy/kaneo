import { client } from "@kaneo/libs";

async function deleteExternalLink(taskId: string, id: string) {
  const response = await client["external-link"].task[":taskId"][":id"].$delete(
    { param: { taskId, id } },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Failed to remove the resource link");
  }

  return response.json();
}

export default deleteExternalLink;
