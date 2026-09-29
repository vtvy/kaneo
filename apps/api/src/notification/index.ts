import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import db, { schema } from "../database";
import { subscribeToEvent } from "../events";
import { notificationSchema } from "../schemas";
import clearNotifications from "./controllers/clear-notifications";
import createNotification from "./controllers/create-notification";
import getNotifications from "./controllers/get-notifications";
import markAllNotificationsAsRead from "./controllers/mark-all-notifications-as-read";
import markAsRead from "./controllers/mark-notification-as-read";

const bulkResultSchema = v.object({
  success: v.boolean(),
  count: v.optional(v.number()),
});

const notification = new Hono<{
  Variables: {
    userId: string;
  };
}>()
  .get(
    "/",
    describeRoute({
      operationId: "listNotifications",
      tags: ["Notifications"],
      description: "Get all notifications for the current user",
      responses: {
        200: {
          description: "List of notifications",
          content: {
            "application/json": {
              schema: resolver(v.array(notificationSchema)),
            },
          },
        },
      },
    }),
    async (c) => {
      const userId = c.get("userId");
      const notifications = await getNotifications(userId);
      return c.json(notifications);
    },
  )
  .post(
    "/",
    describeRoute({
      operationId: "createNotification",
      tags: ["Notifications"],
      description: "Create a new notification for a user",
      responses: {
        200: {
          description: "Notification created successfully",
          content: {
            "application/json": { schema: resolver(notificationSchema) },
          },
        },
      },
    }),
    validator(
      "json",
      v.object({
        title: v.optional(v.nullable(v.string())),
        message: v.optional(v.nullable(v.string())),
        type: v.string(),
        eventData: v.optional(v.nullable(v.record(v.string(), v.unknown()))),
        relatedEntityId: v.optional(v.string()),
        relatedEntityType: v.optional(v.string()),
      }),
    ),
    async (c) => {
      const {
        title,
        message,
        type,
        eventData,
        relatedEntityId,
        relatedEntityType,
      } = c.req.valid("json");
      const userId = c.get("userId");
      const notification = await createNotification({
        userId,
        title,
        content: message,
        type,
        eventData,
        resourceId: relatedEntityId,
        resourceType: relatedEntityType,
      });
      return c.json(notification);
    },
  )
  .patch(
    "/:id/read",
    describeRoute({
      operationId: "markNotificationAsRead",
      tags: ["Notifications"],
      description: "Mark a specific notification as read",
      responses: {
        200: {
          description: "Notification marked as read",
          content: {
            "application/json": { schema: resolver(notificationSchema) },
          },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    async (c) => {
      const { id } = c.req.valid("param");
      const userId = c.get("userId");
      const notification = await markAsRead(id, userId);
      return c.json(notification);
    },
  )
  .patch(
    "/read-all",
    describeRoute({
      operationId: "markAllNotificationsAsRead",
      tags: ["Notifications"],
      description: "Mark all notifications as read for the current user",
      responses: {
        200: {
          description: "All notifications marked as read",
          content: {
            "application/json": { schema: resolver(bulkResultSchema) },
          },
        },
      },
    }),
    async (c) => {
      const userId = c.get("userId");
      const result = await markAllNotificationsAsRead(userId);
      return c.json(result);
    },
  )
  .delete(
    "/clear-all",
    describeRoute({
      operationId: "clearAllNotifications",
      tags: ["Notifications"],
      description: "Clear all notifications for the current user",
      responses: {
        200: {
          description: "All notifications cleared",
          content: {
            "application/json": { schema: resolver(bulkResultSchema) },
          },
        },
      },
    }),
    async (c) => {
      const userId = c.get("userId");
      const result = await clearNotifications(userId);
      return c.json(result);
    },
  );

async function resolveTaskLocation(taskId: string) {
  const [row] = await db
    .select({
      projectId: schema.taskTable.projectId,
      workspaceId: schema.projectTable.workspaceId,
    })
    .from(schema.taskTable)
    .innerJoin(
      schema.projectTable,
      eq(schema.taskTable.projectId, schema.projectTable.id),
    )
    .where(eq(schema.taskTable.id, taskId))
    .limit(1);
  return row ?? null;
}

subscribeToEvent<{
  taskId: string;
  /** Actor who created the task (webhook/activity). */
  userId: string;
  /** Assignee to notify, when present and not the creator. */
  assigneeId?: string | null;
  title: string;
  projectId: string;
}>("task.created", async (data) => {
  const notifyUserId =
    data.assigneeId && data.assigneeId !== data.userId ? data.assigneeId : null;
  if (!notifyUserId) return;

  const loc = await resolveTaskLocation(data.taskId);
  await createNotification({
    userId: notifyUserId,
    type: "task_created",
    eventData: {
      taskTitle: data.title,
      projectId: loc?.projectId,
      workspaceId: loc?.workspaceId,
    },
    resourceId: data.taskId,
    resourceType: "task",
  });
});

subscribeToEvent<{
  workspaceId: string;
  workspaceName: string;
  ownerEmail: string;
  ownerId?: string;
}>("workspace.created", async (data) => {
  if (data.ownerId) {
    await createNotification({
      userId: data.ownerId,
      type: "workspace_created",
      eventData: {
        workspaceName: data.workspaceName,
      },
      resourceId: data.workspaceId,
      resourceType: "workspace",
    });
  }
});

subscribeToEvent<{
  taskId: string;
  userId: string;
  oldStatus: string;
  newStatus: string;
  title: string;
  assigneeId?: string;
}>("task.status_changed", async (data) => {
  if (data.assigneeId && data.assigneeId !== data.userId) {
    const loc = await resolveTaskLocation(data.taskId);
    await createNotification({
      userId: data.assigneeId,
      type: "task_status_changed",
      eventData: {
        taskTitle: data.title,
        oldStatus: data.oldStatus,
        newStatus: data.newStatus,
        projectId: loc?.projectId,
        workspaceId: loc?.workspaceId,
      },
      resourceId: data.taskId,
      resourceType: "task",
    });
  }
});

subscribeToEvent<{
  taskId: string;
  userId: string;
  oldAssignee: string | null;
  newAssignee: string;
  newAssigneeId: string;
  title: string;
}>("task.assignee_changed", async (data) => {
  if (data.newAssigneeId) {
    const loc = await resolveTaskLocation(data.taskId);
    await createNotification({
      userId: data.newAssigneeId,
      type: "task_assignee_changed",
      eventData: {
        taskTitle: data.title,
        projectId: loc?.projectId,
        workspaceId: loc?.workspaceId,
      },
      resourceId: data.taskId,
      resourceType: "task",
    });
  }
});

subscribeToEvent<{
  taskId: string;
  userId: string;
  mentions?: string[];
  taskTitle?: string;
  actorName?: string;
}>("task.comment_created", async (data) => {
  if (!Array.isArray(data.mentions) || data.mentions.length === 0) {
    return;
  }
  const loc = await resolveTaskLocation(data.taskId);
  for (const id of data.mentions) {
    await createNotification({
      userId: id,
      type: "mention",
      eventData: {
        taskTitle: data.taskTitle,
        actorName: data.actorName,
        projectId: loc?.projectId,
        workspaceId: loc?.workspaceId,
      },
      resourceId: data.taskId,
      resourceType: "task",
    });
  }
});

subscribeToEvent<{
  email: string;
  invitationId: string;
  workspaceId: string;
  workspaceName: string;
  inviterName: string;
}>("invitation.created", async (data) => {
  const [user] = await db
    .select({ id: schema.userTable.id })
    .from(schema.userTable)
    .where(eq(schema.userTable.email, data.email))
    .limit(1);
  if (!user) return; // invited email has no account yet -> only the email invite applies
  await createNotification({
    userId: user.id,
    type: "invitation",
    eventData: {
      workspaceName: data.workspaceName,
      inviterName: data.inviterName,
    },
    resourceId: data.workspaceId,
    resourceType: "workspace",
  });
});

subscribeToEvent<{
  taskId: string;
  projectId: string;
  userId: string;
  title?: string;
  number?: number | null;
  reporterId?: string | null;
  assigneeId?: string | null;
  workspaceId?: string;
  deletedByName?: string;
}>("task.deleted", async (data) => {
  const workspaceId =
    data.workspaceId ??
    (await resolveTaskLocation(data.taskId))?.workspaceId ??
    null;

  let deletedByName = data.deletedByName;
  if (!deletedByName) {
    const [actor] = await db
      .select({ name: schema.userTable.name })
      .from(schema.userTable)
      .where(eq(schema.userTable.id, data.userId))
      .limit(1);
    deletedByName = actor?.name ?? data.userId;
  }

  const eventData = {
    taskTitle: data.title,
    taskNumber: data.number ?? null,
    taskId: data.taskId,
    projectId: data.projectId,
    workspaceId,
    deletedById: data.userId,
    deletedByName,
  };

  const recipientIds = new Set<string>();
  // Always keep a notification on the deleter so the action is visible in-app.
  recipientIds.add(data.userId);
  if (data.reporterId) recipientIds.add(data.reporterId);
  if (data.assigneeId) recipientIds.add(data.assigneeId);

  for (const userId of recipientIds) {
    await createNotification({
      userId,
      type: "task_deleted",
      eventData,
      // Task row is gone — link to the project instead.
      resourceId: data.projectId,
      resourceType: "project",
    });
  }
});

subscribeToEvent<{
  timeEntryId: string;
  taskId: string;
  userId: string;
  taskOwnerId?: string;
  taskTitle?: string;
}>("time-entry.created", async (data) => {
  if (data.taskOwnerId && data.taskOwnerId !== data.userId) {
    const loc = await resolveTaskLocation(data.taskId);
    await createNotification({
      userId: data.taskOwnerId,
      type: "time_entry_created",
      eventData: {
        taskTitle: data.taskTitle ?? null,
        projectId: loc?.projectId,
        workspaceId: loc?.workspaceId,
      },
      resourceId: data.taskId,
      resourceType: "task",
    });
  }
});

export default notification;
