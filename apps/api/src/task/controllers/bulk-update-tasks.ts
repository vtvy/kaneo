import { and, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  columnTable,
  labelTable,
  projectTable,
  taskTable,
  workspaceUserTable,
} from "../../database/schema";
import { publishEvent } from "../../events";
import {
  assertValidPriority,
  assertValidTaskStatus,
} from "../validate-task-fields";
import recordTaskDeletion from "./record-task-deletion";
import { recordAssigneeHandoff } from "./record-task-involvement";

type BulkOperation =
  | "updateStatus"
  | "updatePriority"
  | "updateAssignee"
  | "delete"
  | "addLabel"
  | "removeLabel"
  | "updateDueDate";

async function bulkUpdateTasks({
  taskIds,
  operation,
  value,
  userId,
}: {
  taskIds: string[];
  operation: BulkOperation;
  value?: string | null;
  userId: string;
}) {
  const tasks = await db
    .select({
      id: taskTable.id,
      projectId: taskTable.projectId,
      workspaceId: projectTable.workspaceId,
      userId: taskTable.userId,
      title: taskTable.title,
      number: taskTable.number,
      reporterId: taskTable.reporterId,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(inArray(taskTable.id, taskIds));

  if (tasks.length === 0) {
    throw new HTTPException(404, {
      message: "No tasks found",
    });
  }

  const workspaceIds = [...new Set(tasks.map((t) => t.workspaceId))];

  if (workspaceIds.length > 1) {
    throw new HTTPException(400, {
      message: "All tasks must belong to the same workspace",
    });
  }

  const workspaceId = workspaceIds[0];

  if (!workspaceId) {
    throw new HTTPException(400, {
      message: "Could not determine workspace",
    });
  }

  const [membership] = await db
    .select({ id: workspaceUserTable.id })
    .from(workspaceUserTable)
    .where(
      and(
        eq(workspaceUserTable.userId, userId),
        eq(workspaceUserTable.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (!membership) {
    throw new HTTPException(403, {
      message: "You don't have access to this workspace",
    });
  }

  const foundIds = tasks.map((t) => t.id);
  let updatedCount = 0;

  switch (operation) {
    case "updateStatus": {
      // A null/empty value clears the status (moves the task to the backlog).
      const nextStatus = value || null;
      const projectIds = [...new Set(tasks.map((t) => t.projectId))];

      for (const projectId of projectIds) {
        await assertValidTaskStatus(nextStatus, projectId);

        const column = nextStatus
          ? await db.query.columnTable.findFirst({
              where: and(
                eq(columnTable.projectId, projectId),
                eq(columnTable.slug, nextStatus),
              ),
            })
          : null;

        const projectTaskIds = tasks
          .filter((t) => t.projectId === projectId)
          .map((t) => t.id);

        const result = await db
          .update(taskTable)
          .set({ status: nextStatus, columnId: column?.id ?? null })
          .where(inArray(taskTable.id, projectTaskIds));

        updatedCount += result.rowCount ?? projectTaskIds.length;

        for (const taskId of projectTaskIds) {
          await publishEvent("task.status_changed", {
            taskId,
            projectId,
            userId,
            newStatus: nextStatus,
            type: "status_changed",
          });
        }

        await publishEvent("task-relation.refresh", {
          projectId,
          userId,
        });
      }
      break;
    }

    case "updatePriority": {
      if (!value) {
        throw new HTTPException(400, { message: "Priority value is required" });
      }
      assertValidPriority(value);

      const result = await db
        .update(taskTable)
        .set({ priority: value })
        .where(inArray(taskTable.id, foundIds));

      updatedCount = result.rowCount ?? foundIds.length;

      for (const task of tasks) {
        await publishEvent("task.priority_changed", {
          taskId: task.id,
          projectId: task.projectId,
          userId,
          newPriority: value,
          type: "priority_changed",
        });
      }
      break;
    }

    case "updateAssignee": {
      const nextAssigneeId = value || null;
      const result = await db
        .update(taskTable)
        .set({ userId: nextAssigneeId })
        .where(inArray(taskTable.id, foundIds));

      updatedCount = result.rowCount ?? foundIds.length;

      for (const task of tasks) {
        if (task.userId !== nextAssigneeId) {
          await recordAssigneeHandoff({
            taskId: task.id,
            previousAssigneeId: task.userId,
            nextAssigneeId,
          });
        }

        const eventType = value ? "task.assignee_changed" : "task.unassigned";
        await publishEvent(eventType, {
          taskId: task.id,
          projectId: task.projectId,
          userId,
          oldAssignee: task.userId,
          newAssigneeId: nextAssigneeId,
          type: value ? "assignee_changed" : "unassigned",
        });
      }
      break;
    }

    case "delete": {
      for (const task of tasks) {
        const deletion = await recordTaskDeletion(
          {
            taskId: task.id,
            projectId: task.projectId,
            title: task.title,
            number: task.number,
            reporterId: task.reporterId,
            assigneeId: task.userId,
          },
          userId,
        );

        await publishEvent("task.deleted", {
          taskId: task.id,
          projectId: task.projectId,
          userId,
          title: task.title,
          number: task.number,
          reporterId: task.reporterId,
          assigneeId: task.userId,
          workspaceId: deletion?.workspaceId ?? task.workspaceId,
          deletedByName: deletion?.deletedByName,
        });
      }

      const result = await db
        .delete(taskTable)
        .where(inArray(taskTable.id, foundIds));

      updatedCount = result.rowCount ?? foundIds.length;
      break;
    }

    case "addLabel": {
      if (!value) {
        throw new HTTPException(400, { message: "Label ID is required" });
      }

      const label = await db.query.labelTable.findFirst({
        where: eq(labelTable.id, value),
      });

      if (!label) {
        throw new HTTPException(404, { message: "Label not found" });
      }

      for (const task of tasks) {
        const existingAssignment = await db.query.labelTable.findFirst({
          where: and(
            eq(labelTable.name, label.name),
            eq(labelTable.taskId, task.id),
          ),
        });

        if (!existingAssignment) {
          await db
            .insert(labelTable)
            .values({
              name: label.name,
              color: label.color,
              workspaceId: workspaceId,
              taskId: task.id,
            })
            .onConflictDoNothing({
              target: [labelTable.taskId, labelTable.name],
            });
          updatedCount++;

          await publishEvent("task.label_assigned", {
            projectId: task.projectId,
            taskId: task.id,
            userId,
            type: "label_assigned",
          });
        }
      }
      break;
    }

    case "removeLabel": {
      if (!value) {
        throw new HTTPException(400, { message: "Label ID is required" });
      }
      const result = await db
        .update(labelTable)
        .set({ taskId: null })
        .where(
          and(eq(labelTable.id, value), inArray(labelTable.taskId, foundIds)),
        );

      updatedCount = result.rowCount ?? foundIds.length;

      for (const task of tasks) {
        await publishEvent("task.label_unassigned", {
          projectId: task.projectId,
          taskId: task.id,
          userId,
          type: "label_unassigned",
        });
      }
      break;
    }

    case "updateDueDate": {
      let parsedDate: Date | null = null;
      if (value) {
        parsedDate = new Date(value);
        if (Number.isNaN(parsedDate.getTime())) {
          throw new HTTPException(400, {
            message: `Invalid date value "${value}"`,
          });
        }
      }

      const result = await db
        .update(taskTable)
        .set({ dueDate: parsedDate })
        .where(inArray(taskTable.id, foundIds));

      updatedCount = result.rowCount ?? foundIds.length;

      for (const task of tasks) {
        await publishEvent("task.due_date_changed", {
          taskId: task.id,
          projectId: task.projectId,
          userId,
          newDueDate: parsedDate,
          type: "due_date_changed",
        });
      }
      break;
    }

    default: {
      throw new HTTPException(400, {
        message: `Unknown operation "${operation}"`,
      });
    }
  }

  return { success: true, updatedCount };
}

export default bulkUpdateTasks;
