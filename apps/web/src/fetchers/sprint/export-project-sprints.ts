import { client } from "@kaneo/libs";

async function exportProjectSprints(projectId: string) {
  const response = await client.sprint.project[":projectId"].export.$get({
    param: { projectId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Export failed");
  }

  return await response.blob();
}

export default exportProjectSprints;
