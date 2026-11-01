import { and, eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { projectTable, taskTable, workspaceTable } from "../../database/schema";

// "<PROJECTSLUG>-<number>"; slugs may contain dashes, the number may not.
const TICKET_ID_PATTERN = /^(.+)-(\d+)$/u;

export function parseTicketId(ticketId: string) {
  const match = ticketId.trim().match(TICKET_ID_PATTERN);
  const projectSlug = match?.[1];
  const number = Number(match?.[2]);
  if (
    !projectSlug ||
    !Number.isSafeInteger(number) ||
    number < 1 ||
    number > 2_147_483_647
  ) {
    throw new HTTPException(400, { message: "Invalid task ticket ID" });
  }
  return { projectSlug, number };
}

export async function findWorkspaceIdBySlug(workspaceSlug: string) {
  const [workspace] = await db
    .select({ id: workspaceTable.id })
    .from(workspaceTable)
    .where(sql`lower(${workspaceTable.slug}) = lower(${workspaceSlug})`)
    .limit(1);
  if (!workspace) {
    throw new HTTPException(404, { message: "Workspace not found" });
  }
  return workspace.id;
}

// Resolves a short ticket id inside one workspace. Access to the workspace and
// the task's project is checked by the route.
async function getTaskByTicketId(ticketId: string, workspaceId: string) {
  const { projectSlug, number } = parseTicketId(ticketId);

  const [row] = await db
    .select({ taskId: taskTable.id, projectId: projectTable.id })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(
      and(
        eq(projectTable.workspaceId, workspaceId),
        sql`lower(${projectTable.slug}) = lower(${projectSlug})`,
        eq(taskTable.number, number),
      ),
    )
    .limit(1);

  if (!row) {
    throw new HTTPException(404, { message: "Task not found" });
  }

  return row;
}

export default getTaskByTicketId;
