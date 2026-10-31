import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { notificationTable } from "../../database/schema";

// Scoped to the caller: another user's notification id is "not found".
async function deleteNotification(id: string, userId: string) {
  const [deleted] = await db
    .delete(notificationTable)
    .where(
      and(eq(notificationTable.id, id), eq(notificationTable.userId, userId)),
    )
    .returning({ id: notificationTable.id });

  if (!deleted) {
    throw new HTTPException(404, {
      message: "Notification not found",
    });
  }

  return { success: true };
}

export default deleteNotification;
