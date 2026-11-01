import { eq } from "drizzle-orm";
import { userTable, workspaceUserTable } from "../../database/schema";
import type { Transaction } from "./create-import-project";
import type { AssignableMember } from "./match-assignees";

// Only workspace members can be assignees, matching task assignment rules;
// anyone else leaves the task unassigned with a warning.
export async function loadAssignableMembers(
  tx: Transaction,
  workspaceId: string,
): Promise<AssignableMember[]> {
  return tx
    .select({ id: userTable.id, name: userTable.name, email: userTable.email })
    .from(workspaceUserTable)
    .innerJoin(userTable, eq(workspaceUserTable.userId, userTable.id))
    .where(eq(workspaceUserTable.workspaceId, workspaceId));
}
