import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { workspaceTable } from "../../database/schema";

export const WORKSPACE_ARCHIVED_MESSAGE =
  "This workspace is archived and read-only. An instance administrator can restore it.";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function isSafeMethod(method: string) {
  return SAFE_METHODS.has(method.toUpperCase());
}

export async function isWorkspaceArchived(workspaceId: string) {
  const [row] = await db
    .select({ archivedAt: workspaceTable.archivedAt })
    .from(workspaceTable)
    .where(eq(workspaceTable.id, workspaceId))
    .limit(1);
  return Boolean(row?.archivedAt);
}

/**
 * Archived workspaces are read-only for everyone, instance admins included:
 * an admin restores the workspace before changing it. Responds 409 so clients
 * can tell "archived" apart from a missing permission (403).
 */
export async function assertWorkspaceWritable(workspaceId: string) {
  if (await isWorkspaceArchived(workspaceId)) {
    throw new HTTPException(409, { message: WORKSPACE_ARCHIVED_MESSAGE });
  }
}
