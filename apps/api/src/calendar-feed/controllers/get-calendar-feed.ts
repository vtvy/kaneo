import {
  and,
  desc,
  eq,
  exists,
  inArray,
  isNotNull,
  or,
  sql,
} from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  calendarFeedTable,
  labelTable,
  projectTable,
  taskTable,
  userTable,
  workspaceUserTable,
} from "../../database/schema";
import { canInProject } from "../../project-rbac/can-in-project";
import { buildCalendar } from "../ical";
import { hashCalendarFeedToken } from "../token";

export const CALENDAR_FEED_TASK_LIMIT = 1000;
const TITLE_CHARACTERS = 1024;

const notFound = () =>
  new HTTPException(404, { message: "Calendar feed not found" });

function clientUrl() {
  return (process.env.KANEO_CLIENT_URL || "http://localhost:5173").replace(
    /\/+$/,
    "",
  );
}

// Unauthenticated: the token is the credential. Every fetch re-checks that the
// feed owner is still an active workspace member with item:read in the
// project, so removing someone also stops their feeds from leaking tasks.
async function getCalendarFeed(token: string) {
  const [record] = await db
    .select({
      userId: calendarFeedTable.userId,
      labelNames: calendarFeedTable.labelNames,
      timeZone: calendarFeedTable.timeZone,
      projectId: projectTable.id,
      workspaceId: projectTable.workspaceId,
      projectName: sql<string>`left(${projectTable.name}, ${TITLE_CHARACTERS})`,
      banned: userTable.banned,
      banExpires: userTable.banExpires,
    })
    .from(calendarFeedTable)
    .innerJoin(projectTable, eq(projectTable.id, calendarFeedTable.projectId))
    .innerJoin(userTable, eq(userTable.id, calendarFeedTable.userId))
    .innerJoin(
      workspaceUserTable,
      and(
        eq(workspaceUserTable.workspaceId, projectTable.workspaceId),
        eq(workspaceUserTable.userId, calendarFeedTable.userId),
      ),
    )
    .where(eq(calendarFeedTable.tokenHash, hashCalendarFeedToken(token)))
    .limit(1);

  if (!record) throw notFound();

  const isBanned =
    record.banned &&
    (!record.banExpires || record.banExpires.getTime() > Date.now());
  if (isBanned) throw notFound();

  if (!(await canInProject(record.userId, record.projectId, "item", "read"))) {
    throw notFound();
  }

  const tasks = await db
    .select({
      id: taskTable.id,
      title: sql<string>`left(${taskTable.title}, ${TITLE_CHARACTERS})`,
      startDate: taskTable.startDate,
      dueDate: taskTable.dueDate,
      createdAt: taskTable.createdAt,
      updatedAt: taskTable.updatedAt,
    })
    .from(taskTable)
    .where(
      and(
        eq(taskTable.projectId, record.projectId),
        or(isNotNull(taskTable.startDate), isNotNull(taskTable.dueDate)),
        record.labelNames.length
          ? exists(
              db
                .select({ id: labelTable.id })
                .from(labelTable)
                .where(
                  and(
                    eq(labelTable.taskId, taskTable.id),
                    inArray(labelTable.name, record.labelNames),
                  ),
                ),
            )
          : undefined,
      ),
    )
    .orderBy(
      desc(sql`coalesce(${taskTable.dueDate}, ${taskTable.startDate})`),
      desc(taskTable.id),
    )
    .limit(CALENDAR_FEED_TASK_LIMIT);

  const base = clientUrl();
  return buildCalendar({
    name: record.projectName,
    timeZone: record.timeZone,
    tasks: tasks.map((task) => ({
      ...task,
      url: `${base}/dashboard/workspace/${encodeURIComponent(record.workspaceId)}/project/${encodeURIComponent(record.projectId)}/task/${encodeURIComponent(task.id)}`,
    })),
  });
}

export default getCalendarFeed;
