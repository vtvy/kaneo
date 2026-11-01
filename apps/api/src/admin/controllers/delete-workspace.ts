import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  sessionTable,
  workspaceTable,
  workspaceUserTable,
} from "../../database/schema";
import {
  cleanupContainerStorage,
  collectContainerStorage,
} from "../../storage/cleanup-container";
import { recheckSocketAccess } from "../../ws";
import type { AdminAuditRequest } from "../audit/admin-audit-request";
import { recordAdminAction } from "../audit/record-admin-action";
import { lockWorkspace } from "../workspace-lifecycle";

/**
 * Permanently delete a workspace and everything in it (foreign keys cascade).
 * The caller must repeat the workspace name. Members lose access at once:
 * their memberships go with the row, sessions pointing at it are cleared, and
 * open realtime sockets are re-checked and closed.
 */
async function deleteWorkspace(
  audit: AdminAuditRequest,
  workspaceId: string,
  confirmName: string,
) {
  const { name, memberIds, capturedStorage } = await db.transaction(
    async (tx) => {
      const workspace = await lockWorkspace(tx, workspaceId);
      if (confirmName.trim() !== workspace.name.trim()) {
        throw new HTTPException(400, {
          message: "Type the workspace name exactly to confirm deletion.",
        });
      }
      const capturedStorage = await collectContainerStorage(tx, {
        workspaceId,
      });
      const members = await tx
        .select({ userId: workspaceUserTable.userId })
        .from(workspaceUserTable)
        .where(eq(workspaceUserTable.workspaceId, workspaceId));

      await tx
        .update(sessionTable)
        .set({ activeOrganizationId: null, activeTeamId: null })
        .where(eq(sessionTable.activeOrganizationId, workspaceId));
      await tx.delete(workspaceTable).where(eq(workspaceTable.id, workspaceId));
      await recordAdminAction(
        audit,
        {
          action: "workspace.deleted",
          targetType: "workspace",
          targetId: workspace.id,
          targetLabel: workspace.name,
          metadata: { memberCount: members.length },
        },
        tx,
      );
      return {
        name: workspace.name,
        memberIds: members.map((m) => m.userId),
        capturedStorage,
      };
    },
  );

  await Promise.all(
    memberIds.map((userId) => recheckSocketAccess(userId, { workspaceId })),
  );

  await cleanupContainerStorage(capturedStorage);
  return { id: workspaceId, name, deleted: true };
}

export default deleteWorkspace;
