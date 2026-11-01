import type { EmailResult } from "../../../packages/email/src/send-email";

export async function sendMagicLinkEmail(
  _to: string,
  _subject: string,
  _data: unknown,
): Promise<void> {
  return undefined;
}

export async function sendOtpEmail(
  _to: string,
  _subject: string,
  _data: unknown,
): Promise<void> {
  return undefined;
}

export async function sendWorkspaceInvitationEmail(
  _to: string,
  _subject: string,
  _data: unknown,
): Promise<EmailResult> {
  return { success: true };
}

export const isSmtpConfigured = (env: NodeJS.ProcessEnv = process.env) =>
  Boolean(env.SMTP_HOST) && Boolean(env.SMTP_PORT) && Boolean(env.SMTP_FROM);

export const sentTestEmails: { to: string; subject: string }[] = [];

export async function verifySmtpConnection() {
  return isSmtpConfigured()
    ? ({ status: "ok" } as const)
    : ({ status: "not_configured" } as const);
}

export async function sendTestEmail(to: string, subject: string) {
  if (!isSmtpConfigured()) return { success: false };
  sentTestEmails.push({ to, subject });
  return { success: true };
}

export function getSmtpErrorDetails(_error: unknown) {
  return { code: "UNKNOWN" };
}
