import { and, eq } from "drizzle-orm";
import db from "../../database";
import { notificationTable } from "../../database/schema";

async function clearNotifications(userId: string, onlyRead = false) {
  await db
    .delete(notificationTable)
    .where(
      and(
        eq(notificationTable.userId, userId),
        onlyRead ? eq(notificationTable.isRead, true) : undefined,
      ),
    );

  return { success: true };
}

export default clearNotifications;
