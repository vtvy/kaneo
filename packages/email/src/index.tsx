export {
  isSmtpConfigured,
  sendMagicLinkEmail,
  sendNotificationEmail,
  sendOtpEmail,
  sendPasswordResetEmail,
  sendWorkspaceInvitationEmail,
} from "./send-email";
export {
  getSmtpErrorDetails,
  type SmtpCheckResult,
  sendTestEmail,
  verifySmtpConnection,
} from "./smtp-check";
