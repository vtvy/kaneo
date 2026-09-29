import { client } from "@kaneo/libs";

async function getAllProjectTasks(projectId: string) {
  const response = await client.task.all[":projectId"].$get({
    param: { projectId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const json = await response.json();

  return json;
}

export default getAllProjectTasks;
