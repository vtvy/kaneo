import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import db from "../database";
import { userTable } from "../database/schema";
import { getInstanceSettings } from "./get-instance-settings";

/**
 * When workspace creation is restricted (database setting or
 * DISABLE_WORKSPACE_CREATION=true), only instance admins may create one. The
 * role is read from the database, never from the cached session.
 */
export async function assertCanCreateWorkspace(userId: string | undefined) {
  if (!(await getInstanceSettings()).workspaceCreationRestricted) return;
  const [user] = userId
    ? await db
        .select({ role: userTable.role })
        .from(userTable)
        .where(eq(userTable.id, userId))
        .limit(1)
    : [];
  if (user?.role !== "admin") {
    throw new APIError("FORBIDDEN", {
      message: "Only instance administrators can create workspaces.",
    });
  }
}
