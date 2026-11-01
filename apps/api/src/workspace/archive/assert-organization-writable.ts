import { APIError, getSessionFromCtx } from "better-auth/api";
import { eq } from "drizzle-orm";
import db from "../../database";
import { invitationTable } from "../../database/schema";
import {
  isSafeMethod,
  isWorkspaceArchived,
  WORKSPACE_ARCHIVED_MESSAGE,
} from "./workspace-archived";

// Organization endpoints that change nothing in an existing workspace, or that
// only let the caller step away from one.
const ALLOWED_PATHS = new Set([
  "/organization/create",
  "/organization/set-active",
  "/organization/check-slug",
  "/organization/has-permission",
  "/organization/leave",
  "/organization/reject-invitation",
]);

type OrganizationRequest = Parameters<typeof getSessionFromCtx>[0] & {
  path: string;
  request?: Request;
  body?: Record<string, unknown> | null;
};

async function workspaceIdFromInvitation(invitationId: unknown) {
  if (typeof invitationId !== "string") return null;
  const [row] = await db
    .select({ workspaceId: invitationTable.workspaceId })
    .from(invitationTable)
    .where(eq(invitationTable.id, invitationId))
    .limit(1);
  return row?.workspaceId ?? null;
}

async function resolveWorkspaceId(ctx: OrganizationRequest) {
  const body = ctx.body ?? {};
  if (typeof body.organizationId === "string") return body.organizationId;
  const fromInvitation = await workspaceIdFromInvitation(body.invitationId);
  if (fromInvitation) return fromInvitation;
  const session = await getSessionFromCtx(ctx, { disableRefresh: true }).catch(
    () => null,
  );
  const active = (
    session?.session as { activeOrganizationId?: string | null } | undefined
  )?.activeOrganizationId;
  return active ?? null;
}

/**
 * Refuse Better Auth organization writes (rename, invites, member and role
 * changes, ...) against an archived workspace. Server-side calls carry no
 * request and are not affected.
 */
export async function assertOrganizationWritable(ctx: OrganizationRequest) {
  if (!ctx.path.startsWith("/organization/") || !ctx.request) return;
  if (isSafeMethod(ctx.request.method) || ALLOWED_PATHS.has(ctx.path)) return;
  const workspaceId = await resolveWorkspaceId(ctx);
  if (workspaceId && (await isWorkspaceArchived(workspaceId))) {
    throw new APIError("CONFLICT", { message: WORKSPACE_ARCHIVED_MESSAGE });
  }
}
