import { eq } from "drizzle-orm";
import db from "../../database";
import { workspaceTable } from "../../database/schema";
import type { AdminAuditRequest } from "../audit/admin-audit-request";
import { recordAdminAction } from "../audit/record-admin-action";
import { lockWorkspace } from "../workspace-lifecycle";

/**
 * Archive (read-only for everyone) or restore a workspace. Repeating the
 * current state is a no-op and writes no audit entry.
 */
async function setWorkspaceArchived(
  audit: AdminAuditRequest,
  workspaceId: string,
  archived: boolean,
) {
  return db.transaction(async (tx) => {
    const workspace = await lockWorkspace(tx, workspaceId);
    const wasArchived = Boolean(workspace.archivedAt);
    if (wasArchived === archived) {
      return {
        id: workspace.id,
        archivedAt: workspace.archivedAt?.toISOString() ?? null,
        changed: false,
      };
    }
    const archivedAt = archived ? new Date() : null;
    await tx
      .update(workspaceTable)
      .set({ archivedAt, archivedBy: archived ? audit.actorUserId : null })
      .where(eq(workspaceTable.id, workspaceId));
    await recordAdminAction(
      audit,
      {
        action: archived ? "workspace.archived" : "workspace.restored",
        targetType: "workspace",
        targetId: workspace.id,
        targetLabel: workspace.name,
      },
      tx,
    );
    return {
      id: workspace.id,
      archivedAt: archivedAt?.toISOString() ?? null,
      changed: true,
    };
  });
}

export default setWorkspaceArchived;
