import { and, asc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import {
  columnTable,
  projectTable,
  workspaceUserTable,
} from "../database/schema";

export const VALID_PRIORITIES = [
  "no-priority",
  "low",
  "medium",
  "high",
  "urgent",
] as const;

export const VIRTUAL_STATUSES = ["planned", "archived"] as const;

export function assertValidPriority(priority: string): void {
  if (!(VALID_PRIORITIES as readonly string[]).includes(priority)) {
    throw new HTTPException(400, {
      message: `Invalid priority "${priority}". Valid values: ${VALID_PRIORITIES.join(", ")}`,
    });
  }
}

export async function getValidTaskStatuses(
  projectId: string,
): Promise<string[]> {
  const columns = await db
    .select({ slug: columnTable.slug })
    .from(columnTable)
    .where(eq(columnTable.projectId, projectId))
    .orderBy(asc(columnTable.position));

  return [...columns.map((c) => c.slug), ...VIRTUAL_STATUSES];
}

export async function assertValidTaskStatus(
  status: string,
  projectId: string,
): Promise<void> {
  const validStatuses = await getValidTaskStatuses(projectId);

  if (!validStatuses.includes(status)) {
    throw new HTTPException(400, {
      message: `Invalid status "${status}". Valid statuses for this project: ${validStatuses.join(", ")}`,
    });
  }
}

export function coerceStatus(
  status: string,
  validStatuses: string[],
): { status: string; warning?: string } {
  if (validStatuses.includes(status)) {
    return { status };
  }
  return {
    status: "planned",
    warning: `Unknown status "${status}" mapped to "planned"`,
  };
}

export function coercePriority(priority: string): {
  priority: string;
  warning?: string;
} {
  if ((VALID_PRIORITIES as readonly string[]).includes(priority)) {
    return { priority };
  }
  return {
    priority: "no-priority",
    warning: `Unknown priority "${priority}" mapped to "no-priority"`,
  };
}

/**
 * An assignee must belong to the workspace that owns the project; otherwise a
 * caller could attach arbitrary users (e.g. from other workspaces) to tasks
 * and leak task data to them through notifications. Empty means unassigned.
 * Membership also implies the user exists, so the task FK write can't 500.
 */
export async function assertAssigneeInWorkspace(
  assigneeId: string | null | undefined,
  projectId: string,
): Promise<void> {
  if (!assigneeId) {
    return;
  }

  const [membership] = await db
    .select({ id: workspaceUserTable.id })
    .from(projectTable)
    .innerJoin(
      workspaceUserTable,
      eq(workspaceUserTable.workspaceId, projectTable.workspaceId),
    )
    .where(
      and(
        eq(projectTable.id, projectId),
        eq(workspaceUserTable.userId, assigneeId),
      ),
    )
    .limit(1);

  if (!membership) {
    throw new HTTPException(400, {
      message: "Assignee must be a member of this workspace",
    });
  }
}
