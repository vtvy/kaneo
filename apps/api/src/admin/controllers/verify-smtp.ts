import { verifySmtpConnection } from "@kaneo/email";
import type { AdminAuditRequest } from "../audit/admin-audit-request";
import { recordAdminAction } from "../audit/record-admin-action";
import { withTimeout } from "../system/with-timeout";

const TIMEOUT_MS = 10_000;

/**
 * Connect and authenticate to the configured SMTP server without sending
 * anything. Only the error category is returned, never server messages.
 */
async function verifySmtp(audit: AdminAuditRequest) {
  const result = await withTimeout(
    () => verifySmtpConnection(TIMEOUT_MS),
    TIMEOUT_MS + 1_000,
  ).catch(() => ({ status: "failed" as const, code: "TIMEOUT" }));

  await recordAdminAction(audit, {
    action: "email.smtp_verified",
    targetType: "instance",
    metadata: {
      status: result.status,
      ...(result.status === "failed" ? { code: result.code } : {}),
    },
  });

  return result.status === "failed"
    ? {
        status: result.status,
        code: result.code,
        responseCode:
          "responseCode" in result ? (result.responseCode ?? null) : null,
      }
    : { status: result.status, code: null, responseCode: null };
}

export default verifySmtp;
