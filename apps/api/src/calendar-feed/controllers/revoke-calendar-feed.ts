import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { calendarFeedTable } from "../../database/schema";

async function revokeCalendarFeed(
  projectId: string,
  id: string,
  userId: string,
) {
  const [feed] = await db
    .delete(calendarFeedTable)
    .where(
      and(
        eq(calendarFeedTable.id, id),
        eq(calendarFeedTable.projectId, projectId),
        eq(calendarFeedTable.userId, userId),
      ),
    )
    .returning({ id: calendarFeedTable.id });
  if (!feed) {
    throw new HTTPException(404, { message: "Calendar feed not found" });
  }
  return { success: true };
}

export default revokeCalendarFeed;
