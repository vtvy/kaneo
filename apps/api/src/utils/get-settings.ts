import { config } from "dotenv-mono";
import { isGithubSsoConfigured } from "./github-sso-env";

config();

function getSettings() {
  return {
    disableRegistration: process.env.DISABLE_REGISTRATION === "true",
    disablePasswordRegistration:
      process.env.DISABLE_PASSWORD_REGISTRATION === "true",
    isDemoMode: process.env.DEMO_MODE === "true",
    // Same rule as isSmtpConfigured in packages/email: host, port and sender
    // are required; SMTP_SECURE and credentials are optional (auth-less relay).
    hasSmtp:
      Boolean(process.env.SMTP_HOST) &&
      Boolean(process.env.SMTP_PORT) &&
      Boolean(process.env.SMTP_FROM),
    hasGithubSignIn: isGithubSsoConfigured(),
    hasGoogleSignIn:
      Boolean(process.env.GOOGLE_CLIENT_ID) &&
      Boolean(process.env.GOOGLE_CLIENT_SECRET),
    hasDiscordSignIn:
      Boolean(process.env.DISCORD_CLIENT_ID) &&
      Boolean(process.env.DISCORD_CLIENT_SECRET),
    hasCustomOAuth:
      Boolean(process.env.CUSTOM_OAUTH_CLIENT_ID) &&
      Boolean(process.env.CUSTOM_OAUTH_CLIENT_SECRET),
    hasGuestAccess: process.env.DISABLE_GUEST_ACCESS !== "true",
    customOAuthLogoutUrl: process.env.CUSTOM_OAUTH_LOGOUT_URL || null,
  };
}

export default getSettings;
