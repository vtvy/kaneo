import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import type Task from "@/types/task";

type UpdateTaskJson = InferRequestType<
  (typeof client)["task"][":id"]["$put"]
>["json"];

async function updateTask(taskId: string, task: Task) {
  const response = await client.task[":id"].$put({
    param: { id: taskId },
    json: {
      userId: task.userId || "",
      title: task.title,
      description: task.description || "",
      status: task.status,
      priority: (task.priority || "no-priority") as UpdateTaskJson["priority"],
      points: task.points ?? undefined,
      startDate: task.startDate?.toString(),
      dueDate: task.dueDate?.toString(),
      position: task.position ?? 0,
      projectId: task.projectId,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();

  return data;
}

export default updateTask;
