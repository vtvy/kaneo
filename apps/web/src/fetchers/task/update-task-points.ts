import { client } from "@kaneo/libs";

async function updateTaskPoints(taskId: string, points: number | null) {
  const response = await client.task.points[":id"].$put({
    param: { id: taskId },
    json: {
      points,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();

  return data;
}

export default updateTaskPoints;
