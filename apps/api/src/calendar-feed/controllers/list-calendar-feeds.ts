import { and, asc, eq } from "drizzle-orm";
import db from "../../database";
import { calendarFeedTable } from "../../database/schema";
import { feedColumns } from "./create-calendar-feed";

// Feeds are personal: each user only sees (and manages) their own links.
async function listCalendarFeeds(projectId: string, userId: string) {
  return db
    .select(feedColumns)
    .from(calendarFeedTable)
    .where(
      and(
        eq(calendarFeedTable.projectId, projectId),
        eq(calendarFeedTable.userId, userId),
      ),
    )
    .orderBy(asc(calendarFeedTable.createdAt), asc(calendarFeedTable.id));
}

export default listCalendarFeeds;
