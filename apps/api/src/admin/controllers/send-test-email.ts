import {
  getSmtpErrorDetails,
  isSmtpConfigured,
  sendTestEmail,
} from "@kaneo/email";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { userTable } from "../../database/schema";
import type { AdminAuditRequest } from "../audit/admin-audit-request";
import { recordAdminAction } from "../audit/record-admin-action";
import { createAttemptLimiter } from "../system/attempt-limiter";

export const testEmailLimiter = createAttemptLimiter({
  max: 5,
  windowMs: 10 * 60 * 1000,
});

function notConfigured() {
  return new HTTPException(409, {
    message:
      "Email is not configured on this instance. Set SMTP_HOST, SMTP_PORT and SMTP_FROM, then restart Kaneo.",
  });
}

/**
 * Send an SMTP test to the calling administrator's own address. There is no
 * recipient parameter, so this can't be used to relay mail to anyone else.
 */
async function sendAdminTestEmail(audit: AdminAuditRequest) {
  if (!isSmtpConfigured()) throw notConfigured();

  const decision = testEmailLimiter.take(audit.actorUserId);
  if (!decision.allowed) {
    throw new HTTPException(429, {
      res: Response.json(
        {
          message: `Too many test emails. Try again in ${decision.retryAfterSeconds} seconds.`,
        },
        {
          status: 429,
          headers: { "Retry-After": String(decision.retryAfterSeconds) },
        },
      ),
    });
  }

  const [actor] = await db
    .select({ email: userTable.email })
    .from(userTable)
    .where(eq(userTable.id, audit.actorUserId))
    .limit(1);
  if (!actor) throw new HTTPException(404, { message: "User not found" });

  try {
    const result = await sendTestEmail(actor.email, "Kaneo test email");
    if (!result.success) throw notConfigured();
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    const details = getSmtpErrorDetails(error);
    await recordAdminAction(audit, {
      action: "email.test_failed",
      targetType: "user",
      targetId: audit.actorUserId,
      targetLabel: actor.email,
      metadata: details,
    });
    const reason =
      "responseCode" in details && details.responseCode
        ? `${details.code} ${details.responseCode}`
        : details.code;
    throw new HTTPException(502, {
      message: `The mail server did not accept the test email (${reason}). Check the SMTP settings and the API logs.`,
    });
  }

  await recordAdminAction(audit, {
    action: "email.test_sent",
    targetType: "user",
    targetId: audit.actorUserId,
    targetLabel: actor.email,
  });

  return { sent: true, to: actor.email };
}

export default sendAdminTestEmail;
