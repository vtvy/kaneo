import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { notificationTable } from "../../database/schema";

// Scoped to the caller: another user's notification id is "not found".
export async function setNotificationRead(
  id: string,
  userId: string,
  isRead: boolean,
) {
  const [notification] = await db
    .update(notificationTable)
    .set({ isRead })
    .where(
      and(eq(notificationTable.id, id), eq(notificationTable.userId, userId)),
    )
    .returning();

  if (!notification) {
    throw new HTTPException(404, {
      message: "Notification not found",
    });
  }

  return notification;
}

async function markNotificationAsRead(id: string, userId: string) {
  return setNotificationRead(id, userId, true);
}

export default markNotificationAsRead;
