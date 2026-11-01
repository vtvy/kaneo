import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { workspaceTable } from "../database/schema";
import type { DbOrTx } from "./audit/record-admin-action";

/** Lock and return a workspace row, or 404. */
export async function lockWorkspace(tx: DbOrTx, workspaceId: string) {
  const [workspace] = await tx
    .select({
      id: workspaceTable.id,
      name: workspaceTable.name,
      archivedAt: workspaceTable.archivedAt,
    })
    .from(workspaceTable)
    .where(eq(workspaceTable.id, workspaceId))
    .for("update")
    .limit(1);
  if (!workspace) {
    throw new HTTPException(404, { message: "Workspace not found" });
  }
  return workspace;
}
