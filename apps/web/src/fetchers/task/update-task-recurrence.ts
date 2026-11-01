import { client } from "@kaneo/libs";
import type { TaskRecurrence } from "@/types/task";

async function updateTaskRecurrence(
  taskId: string,
  recurrence: TaskRecurrence | null,
) {
  const response = await client.task.recurrence[":id"].$put({
    param: { id: taskId },
    json: { recurrence },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default updateTaskRecurrence;
