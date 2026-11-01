import { render } from "@react-email/components";
import { config } from "dotenv-mono";
import * as nodemailer from "nodemailer";
import type { MagicLinkEmailProps } from "./templates/magic-link";
import MagicLinkEmail from "./templates/magic-link";
import NotificationEmail, {
  type NotificationEmailProps,
} from "./templates/notification";
import type { OtpEmailProps } from "./templates/otp";
import OtpEmail from "./templates/otp";
import PasswordResetEmail, {
  type PasswordResetEmailProps,
} from "./templates/password-reset";
import WorkspaceInvitationEmail, {
  type WorkspaceInvitationEmailProps,
} from "./templates/workspace-invitation";

config();

// Credentials are optional: an internal relay may accept mail without AUTH.
// Passing an auth object with an empty user would make nodemailer attempt a
// LOGIN anyway, so only send credentials when a user is configured.
export const getSmtpAuth = (env: NodeJS.ProcessEnv = process.env) =>
  env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  secure: process.env.SMTP_SECURE !== "false",
  port: Number(process.env.SMTP_PORT),
  auth: getSmtpAuth(),
  requireTLS: process.env.SMTP_REQUIRE_TLS === "true",
  ignoreTLS: process.env.SMTP_IGNORE_TLS === "true",
});

export const sendMagicLinkEmail = async (
  to: string,
  subject: string,
  data: MagicLinkEmailProps,
) => {
  const emailTemplate = await render(MagicLinkEmail(data));
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      html: emailTemplate,
    });
  } catch (error) {
    console.error("Error sending magic link email", error);
  }
};

export const sendOtpEmail = async (
  to: string,
  subject: string,
  data: OtpEmailProps,
) => {
  const emailTemplate = await render(OtpEmail(data));
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      html: emailTemplate,
    });
  } catch (error) {
    console.error("Error sending OTP email", error);
  }
};

export const sendPasswordResetEmail = async (
  to: string,
  subject: string,
  data: PasswordResetEmailProps,
): Promise<void> => {
  const emailTemplate = await render(PasswordResetEmail(data));
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      html: emailTemplate,
    });
  } catch (error) {
    console.error("Error sending password reset email", error);
    // Rethrow so callers can record delivery failures instead of
    // treating an unsent reset link as success.
    throw error;
  }
};

export type EmailResult = {
  success: boolean;
  reason?: "SMTP_NOT_CONFIGURED";
};

// Matches the API's `hasSmtp` gate (apps/api/src/utils/get-settings.ts):
// a server (host + port) and a sender address are required. Credentials
// and SMTP_SECURE are optional, so an unauthenticated relay counts as
// configured.
export const isSmtpConfigured = (env: NodeJS.ProcessEnv = process.env) =>
  Boolean(env.SMTP_HOST) && Boolean(env.SMTP_PORT) && Boolean(env.SMTP_FROM);

export const sendWorkspaceInvitationEmail = async (
  to: string,
  subject: string,
  data: WorkspaceInvitationEmailProps,
): Promise<EmailResult> => {
  if (!isSmtpConfigured()) {
    return { success: false, reason: "SMTP_NOT_CONFIGURED" };
  }

  try {
    const emailTemplate = await render(
      WorkspaceInvitationEmail({ ...data, to }),
    );
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      html: emailTemplate,
    });
    return { success: true };
  } catch (error) {
    console.error("Error sending workspace invitation email", error);
    throw error;
  }
};

export const sendNotificationEmail = async (
  to: string,
  subject: string,
  data: NotificationEmailProps,
): Promise<EmailResult> => {
  if (!isSmtpConfigured()) {
    return { success: false, reason: "SMTP_NOT_CONFIGURED" };
  }

  try {
    const emailTemplate = await render(NotificationEmail(data));
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      html: emailTemplate,
    });
    return { success: true };
  } catch (error) {
    console.error("Error sending notification email", error);
    throw error;
  }
};

export type FeedbackEmailData = {
  message: string;
  senderName: string;
  senderEmail: string;
  pageUrl?: string;
};

function singleLine(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export const sendFeedbackEmail = async (
  to: string,
  data: FeedbackEmailData,
): Promise<EmailResult> => {
  if (!isSmtpConfigured()) {
    return { success: false, reason: "SMTP_NOT_CONFIGURED" };
  }

  const senderName =
    singleLine(data.senderName) || data.senderEmail || "Unknown user";
  const senderEmail = singleLine(data.senderEmail);
  const pageUrl = data.pageUrl?.trim() ?? "";
  const safePageUrl = /^https?:\/\//i.test(pageUrl) ? pageUrl : "";
  const subject = `Kaneo feedback from ${senderName}`;
  const text = [
    data.message.trim(),
    "",
    `From: ${senderName}${senderEmail ? ` <${senderEmail}>` : ""}`,
    safePageUrl ? `Page: ${safePageUrl}` : "",
  ]
    .filter((line) => line !== "")
    .join("\n");
  const html = [
    `<div style="white-space:pre-wrap;font-family:sans-serif">${escapeHtml(data.message.trim())}</div>`,
    "<hr />",
    `<p>From: ${escapeHtml(senderName)}${senderEmail ? ` &lt;${escapeHtml(senderEmail)}&gt;` : ""}</p>`,
    safePageUrl
      ? `<p>Page: <a href="${escapeHtml(safePageUrl)}">${escapeHtml(safePageUrl)}</a></p>`
      : "",
  ].join("");

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      replyTo: senderEmail || undefined,
      subject,
      text,
      html,
    });
    return { success: true };
  } catch (error) {
    console.error("Error sending feedback email", error);
    throw error;
  }
};
