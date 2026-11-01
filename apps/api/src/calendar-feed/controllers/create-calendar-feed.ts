import { and, count, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  calendarFeedTable,
  labelTable,
  projectTable,
} from "../../database/schema";
import { generateCalendarFeedToken, hashCalendarFeedToken } from "../token";

export const MAX_FEEDS_PER_USER_PROJECT = 10;

const feedColumns = {
  id: calendarFeedTable.id,
  projectId: calendarFeedTable.projectId,
  labelNames: calendarFeedTable.labelNames,
  timeZone: calendarFeedTable.timeZone,
  createdAt: calendarFeedTable.createdAt,
};

// The plaintext token is returned once; only its hash is stored.
async function createCalendarFeed({
  projectId,
  userId,
  labelNames,
  timeZone,
}: {
  projectId: string;
  userId: string;
  labelNames: string[];
  timeZone: string;
}) {
  const names = [...new Set(labelNames.map((name) => name.trim()))].filter(
    Boolean,
  );

  const [project] = await db
    .select({ workspaceId: projectTable.workspaceId })
    .from(projectTable)
    .where(eq(projectTable.id, projectId))
    .limit(1);
  if (!project) throw new HTTPException(404, { message: "Project not found" });

  if (names.length) {
    const existing = await db
      .selectDistinct({ name: labelTable.name })
      .from(labelTable)
      .where(
        and(
          eq(labelTable.workspaceId, project.workspaceId),
          inArray(labelTable.name, names),
        ),
      );
    if (existing.length !== names.length) {
      throw new HTTPException(400, {
        message: "Select labels from this workspace",
      });
    }
  }

  const [existingFeeds] = await db
    .select({ total: count() })
    .from(calendarFeedTable)
    .where(
      and(
        eq(calendarFeedTable.projectId, projectId),
        eq(calendarFeedTable.userId, userId),
      ),
    );
  if ((existingFeeds?.total ?? 0) >= MAX_FEEDS_PER_USER_PROJECT) {
    throw new HTTPException(400, {
      message: `You can have at most ${MAX_FEEDS_PER_USER_PROJECT} calendar feeds per project`,
    });
  }

  const token = generateCalendarFeedToken();
  const [feed] = await db
    .insert(calendarFeedTable)
    .values({
      projectId,
      userId,
      labelNames: names.sort((a, b) => a.localeCompare(b)),
      timeZone,
      tokenHash: hashCalendarFeedToken(token),
    })
    .returning(feedColumns);

  return { ...feed, token };
}

export { feedColumns };
export default createCalendarFeed;
