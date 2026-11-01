import { eq } from "drizzle-orm";
import { lockWorkspace } from "../../admin/workspace-lifecycle";
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

/** Called only after Better Auth has authorized organization deletion. */
export async function deleteWorkspaceData(workspaceId: string) {
  const { captured, members } = await db.transaction(async (tx) => {
    await lockWorkspace(tx, workspaceId);
    const captured = await collectContainerStorage(tx, { workspaceId });
    const members = await tx
      .select({ userId: workspaceUserTable.userId })
      .from(workspaceUserTable)
      .where(eq(workspaceUserTable.workspaceId, workspaceId));
    await tx
      .update(sessionTable)
      .set({ activeOrganizationId: null, activeTeamId: null })
      .where(eq(sessionTable.activeOrganizationId, workspaceId));
    await tx.delete(workspaceTable).where(eq(workspaceTable.id, workspaceId));
    return { captured, members };
  });
  await Promise.all(
    members.map((member) =>
      recheckSocketAccess(member.userId, { workspaceId }),
    ),
  );
  await cleanupContainerStorage(captured);
}
