import * as nodemailer from "nodemailer";
import { getSmtpAuth, isSmtpConfigured } from "./send-email";

export type SmtpCheckResult =
  | { status: "not_configured" }
  | { status: "ok" }
  | { status: "failed"; code: string; responseCode?: number };

/**
 * Only the nodemailer error category and SMTP status code leave this module:
 * server messages can echo usernames or other configuration details.
 */
export function getSmtpErrorDetails(error: unknown): {
  code: string;
  responseCode?: number;
} {
  const value = error as { code?: unknown; responseCode?: unknown } | null;
  const code =
    typeof value?.code === "string" && /^[A-Z_]{1,32}$/.test(value.code)
      ? value.code
      : "UNKNOWN";
  return typeof value?.responseCode === "number"
    ? { code, responseCode: value.responseCode }
    : { code };
}

function createBoundedTransport(env: NodeJS.ProcessEnv, timeoutMs: number) {
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    secure: env.SMTP_SECURE !== "false",
    port: Number(env.SMTP_PORT),
    auth: getSmtpAuth(env),
    requireTLS: env.SMTP_REQUIRE_TLS === "true",
    ignoreTLS: env.SMTP_IGNORE_TLS === "true",
    connectionTimeout: timeoutMs,
    greetingTimeout: timeoutMs,
    socketTimeout: timeoutMs,
  });
}

/**
 * Connect to the SMTP server, authenticate when credentials are set, and
 * disconnect without sending anything.
 */
export async function verifySmtpConnection(
  timeoutMs = 10_000,
  env: NodeJS.ProcessEnv = process.env,
): Promise<SmtpCheckResult> {
  if (!isSmtpConfigured(env)) return { status: "not_configured" };
  const transport = createBoundedTransport(env, timeoutMs);
  try {
    await transport.verify();
    return { status: "ok" };
  } catch (error) {
    return { status: "failed", ...getSmtpErrorDetails(error) };
  } finally {
    transport.close();
  }
}

/** Send a plain test message. Throws when the server refuses it. */
export async function sendTestEmail(
  to: string,
  subject: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ success: boolean }> {
  if (!isSmtpConfigured(env)) return { success: false };
  const transport = createBoundedTransport(env, 15_000);
  try {
    await transport.sendMail({
      from: env.SMTP_FROM,
      to,
      subject,
      text: "This is a test email from your Kaneo instance. Email delivery is working.",
      html: "<p>This is a test email from your Kaneo instance. Email delivery is working.</p>",
    });
    return { success: true };
  } finally {
    transport.close();
  }
}
