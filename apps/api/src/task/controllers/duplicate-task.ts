import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { labelTable, projectTable, taskTable } from "../../database/schema";
import createTask from "./create-task";

// Copies a task's own fields and labels into a new task in the same project.
// Comments, activity, relations and repeat rules stay with the original.
async function duplicateTask({
  taskId,
  currentUserId,
  title,
}: {
  taskId: string;
  currentUserId: string;
  title?: string;
}) {
  const sourceTask = await db.query.taskTable.findFirst({
    where: eq(taskTable.id, taskId),
  });

  if (!sourceTask) {
    throw new HTTPException(404, { message: "Task not found" });
  }

  const [project] = await db
    .select({ workspaceId: projectTable.workspaceId })
    .from(projectTable)
    .where(eq(projectTable.id, sourceTask.projectId))
    .limit(1);

  if (!project) {
    throw new HTTPException(404, { message: "Project not found" });
  }

  const duplicated = await createTask({
    projectId: sourceTask.projectId,
    currentUserId,
    userId: sourceTask.userId ?? undefined,
    title: title?.trim() || sourceTask.title,
    status: sourceTask.status,
    sprintId: sourceTask.sprintId,
    startDate: sourceTask.startDate ?? undefined,
    dueDate: sourceTask.dueDate ?? undefined,
    description: sourceTask.description ?? "",
    priority: sourceTask.priority ?? "no-priority",
    points: sourceTask.points,
  });

  const sourceLabels = await db
    .select({
      name: labelTable.name,
      color: labelTable.color,
      workspaceId: labelTable.workspaceId,
    })
    .from(labelTable)
    .where(
      and(
        eq(labelTable.taskId, sourceTask.id),
        eq(labelTable.workspaceId, project.workspaceId),
      ),
    );

  if (sourceLabels.length > 0) {
    await db.insert(labelTable).values(
      sourceLabels.map((label) => ({
        name: label.name,
        color: label.color,
        taskId: duplicated.id,
        workspaceId: label.workspaceId,
      })),
    );
  }

  return duplicated;
}

export default duplicateTask;
