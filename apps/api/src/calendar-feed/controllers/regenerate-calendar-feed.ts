import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { calendarFeedTable } from "../../database/schema";
import { generateCalendarFeedToken, hashCalendarFeedToken } from "../token";
import { feedColumns } from "./create-calendar-feed";

// Rotates the secret: the old link stops working immediately.
async function regenerateCalendarFeed(
  projectId: string,
  id: string,
  userId: string,
) {
  const token = generateCalendarFeedToken();
  const [feed] = await db
    .update(calendarFeedTable)
    .set({ tokenHash: hashCalendarFeedToken(token) })
    .where(
      and(
        eq(calendarFeedTable.id, id),
        eq(calendarFeedTable.projectId, projectId),
        eq(calendarFeedTable.userId, userId),
      ),
    )
    .returning(feedColumns);
  if (!feed) {
    throw new HTTPException(404, { message: "Calendar feed not found" });
  }
  return { ...feed, token };
}

export default regenerateCalendarFeed;
