import { client } from "@kaneo/libs";

async function createExternalLink(
  taskId: string,
  body: { url: string; title?: string },
) {
  const response = await client["external-link"].task[":taskId"].$post({
    param: { taskId },
    json: body,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Failed to add the resource link");
  }

  return response.json();
}

export default createExternalLink;
