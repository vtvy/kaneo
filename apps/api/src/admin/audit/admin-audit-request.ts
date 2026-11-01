import type { Context } from "hono";

/** Who performed an admin action, and from where. */
export type AdminAuditRequest = {
  actorUserId: string;
  ipAddress: string | null;
  userAgent: string | null;
};

const MAX_USER_AGENT_LENGTH = 512;

export function adminAuditRequest(c: Context): AdminAuditRequest {
  const forwarded = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    actorUserId: c.get("userId"),
    ipAddress: forwarded || c.req.header("x-real-ip") || null,
    userAgent:
      c.req.header("user-agent")?.slice(0, MAX_USER_AGENT_LENGTH) ?? null,
  };
}
