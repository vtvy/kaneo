import { and, eq, gt, inArray, lte, ne, sql } from "drizzle-orm";
import db from "../database";
import {
  notificationTable,
  projectMemberTable,
  projectTable,
  sprintTable,
  workspaceUserTable,
} from "../database/schema";
import createNotification from "../notification/controllers/create-notification";

export type SprintNotificationType = "sprint_started" | "sprint_ended";

// Sprints are date-driven: a sprint "starts" when its start date passes and
// "ends" when its end date passes (or it is completed by hand). The scheduler
// only looks back this far so a fresh deploy does not notify about every
// historical sprint.
const LOOKBACK_MS = 24 * 60 * 60 * 1000;

type SprintRow = {
  id: string;
  name: string;
  projectId: string;
};

const COPY: Record<
  SprintNotificationType,
  { title: string; content: (sprint: string, project: string) => string }
> = {
  sprint_started: {
    title: "Sprint started",
    content: (sprint, project) => `${sprint} has started in ${project}.`,
  },
  sprint_ended: {
    title: "Sprint ended",
    content: (sprint, project) => `${sprint} has ended in ${project}.`,
  },
};

/**
 * Notify the project's members (still in the workspace) that a sprint started
 * or ended. Idempotent: members who already have this notification for this
 * sprint are skipped, so repeated scheduler runs and the completion event
 * never duplicate it.
 */
export async function notifySprintMembers(
  sprint: SprintRow,
  type: SprintNotificationType,
  excludeUserId?: string | null,
): Promise<number> {
  const [project] = await db
    .select({ name: projectTable.name, workspaceId: projectTable.workspaceId })
    .from(projectTable)
    .where(eq(projectTable.id, sprint.projectId))
    .limit(1);
  if (!project) return 0;

  const members = await db
    .selectDistinct({ userId: projectMemberTable.userId })
    .from(projectMemberTable)
    .innerJoin(
      workspaceUserTable,
      and(
        eq(workspaceUserTable.userId, projectMemberTable.userId),
        eq(workspaceUserTable.workspaceId, project.workspaceId),
      ),
    )
    .where(eq(projectMemberTable.projectId, sprint.projectId));

  const candidateIds = members
    .map((member) => member.userId)
    .filter((userId) => userId !== excludeUserId);
  if (candidateIds.length === 0) return 0;

  const alreadyNotified = await db
    .select({ userId: notificationTable.userId })
    .from(notificationTable)
    .where(
      and(
        eq(notificationTable.type, type),
        eq(notificationTable.resourceType, "project"),
        eq(notificationTable.resourceId, sprint.projectId),
        sql`${notificationTable.eventData}->>'sprintId' = ${sprint.id}`,
        inArray(notificationTable.userId, candidateIds),
      ),
    );
  const notified = new Set(alreadyNotified.map((row) => row.userId));

  const copy = COPY[type];
  let sent = 0;
  for (const userId of candidateIds) {
    if (notified.has(userId)) continue;
    await createNotification({
      userId,
      type,
      title: copy.title,
      content: copy.content(sprint.name, project.name),
      eventData: {
        sprintId: sprint.id,
        sprintName: sprint.name,
        projectId: sprint.projectId,
        projectName: project.name,
        workspaceId: project.workspaceId,
      },
      resourceId: sprint.projectId,
      resourceType: "project",
    });
    sent++;
  }
  return sent;
}

/**
 * Scheduler job: notify members of sprints whose start or end date passed
 * within the lookback window. Completed sprints are skipped here; their
 * "ended" notification comes from the completion event.
 */
export async function checkSprintLifecycle(now = new Date()): Promise<void> {
  const since = new Date(now.getTime() - LOOKBACK_MS);
  const columns = {
    id: sprintTable.id,
    name: sprintTable.name,
    projectId: sprintTable.projectId,
  };

  const started = await db
    .select(columns)
    .from(sprintTable)
    .where(
      and(
        ne(sprintTable.state, "completed"),
        gt(sprintTable.startDate, since),
        lte(sprintTable.startDate, now),
      ),
    );

  const ended = await db
    .select(columns)
    .from(sprintTable)
    .where(
      and(
        ne(sprintTable.state, "completed"),
        gt(sprintTable.endDate, since),
        lte(sprintTable.endDate, now),
      ),
    );

  const jobs: [SprintRow[], SprintNotificationType][] = [
    [started, "sprint_started"],
    [ended, "sprint_ended"],
  ];
  for (const [sprints, type] of jobs) {
    for (const sprint of sprints) {
      try {
        await notifySprintMembers(sprint, type);
      } catch (error) {
        console.error("Failed to send sprint notification", {
          sprintId: sprint.id,
          type,
          error,
        });
      }
    }
  }
}
