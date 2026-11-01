import { isSameDay } from "date-fns";

type InboxNotification = {
  type: string;
  isRead: boolean | null;
  createdAt: string;
  resourceId: string | null;
  resourceType: string | null;
  eventData: unknown;
};

export type InboxFilter = "all" | "unread" | "mentions";

export function filterNotifications<T extends InboxNotification>(
  notifications: T[],
  filter: InboxFilter,
): T[] {
  if (filter === "unread") {
    return notifications.filter((notification) => !notification.isRead);
  }
  if (filter === "mentions") {
    return notifications.filter(
      (notification) => notification.type === "mention",
    );
  }
  return notifications;
}

export function groupNotifications<T extends InboxNotification>(
  notifications: T[],
  now = new Date(),
) {
  const today: T[] = [];
  const earlier: T[] = [];

  for (const notification of notifications) {
    if (isSameDay(new Date(notification.createdAt), now)) {
      today.push(notification);
    } else {
      earlier.push(notification);
    }
  }

  return { today, earlier };
}

export type NotificationLink =
  | {
      to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId";
      params: { workspaceId: string; projectId: string; taskId: string };
    }
  | {
      to: "/dashboard/workspace/$workspaceId/project/$projectId";
      params: { workspaceId: string; projectId: string };
    }
  | { to: "/dashboard/invitations" };

// Where clicking a notification goes; null when it has nothing to open.
export function getNotificationLink(
  notification: InboxNotification,
): NotificationLink | null {
  const eventData =
    notification.eventData &&
    typeof notification.eventData === "object" &&
    !Array.isArray(notification.eventData)
      ? (notification.eventData as Record<string, unknown>)
      : {};
  const { workspaceId, projectId } = eventData;
  const resourceId = notification.resourceId;

  if (
    notification.resourceType === "task" &&
    typeof workspaceId === "string" &&
    typeof projectId === "string" &&
    resourceId
  ) {
    return {
      to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
      params: { workspaceId, projectId, taskId: resourceId },
    };
  }

  if (
    notification.resourceType === "project" &&
    typeof workspaceId === "string" &&
    resourceId
  ) {
    return {
      to: "/dashboard/workspace/$workspaceId/project/$projectId",
      params: { workspaceId, projectId: resourceId },
    };
  }

  if (notification.resourceType === "workspace") {
    return { to: "/dashboard/invitations" };
  }

  return null;
}
