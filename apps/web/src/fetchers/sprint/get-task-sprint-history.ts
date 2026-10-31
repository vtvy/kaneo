import { client } from "@kaneo/libs";

async function getTaskSprintHistory(taskId: string) {
  const response = await client.sprint.task[":taskId"].history.$get({
    param: { taskId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return await response.json();
}

export default getTaskSprintHistory;
