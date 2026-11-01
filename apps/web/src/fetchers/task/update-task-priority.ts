import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import type Task from "@/types/task";

type TaskPriority = InferRequestType<
  (typeof client)["task"]["priority"][":id"]["$put"]
>["json"]["priority"];

const TASK_PRIORITIES = [
  "no-priority",
  "low",
  "medium",
  "high",
  "urgent",
] as const satisfies readonly TaskPriority[];

function isTaskPriority(value: string): value is TaskPriority {
  return TASK_PRIORITIES.some((priority) => priority === value);
}

async function updateTaskPriority(taskId: string, task: Task) {
  const rawPriority = task.priority ?? "";
  const priority = isTaskPriority(rawPriority) ? rawPriority : "no-priority";

  const response = await client.task.priority[":id"].$put({
    param: { id: taskId },
    json: {
      priority,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();

  return data;
}

export default updateTaskPriority;
