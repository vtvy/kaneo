/** GitHub/Gitea project integrations (hidden on internal deploy until needed). */
export const showGitIntegrations =
  import.meta.env.VITE_SHOW_GIT_INTEGRATIONS === "true";

/** Generic JSON webhook project integration. */
export const showGenericWebhookIntegration =
  import.meta.env.VITE_SHOW_GENERIC_WEBHOOK_INTEGRATION === "true";
