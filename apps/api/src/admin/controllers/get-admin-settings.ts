import { isSmtpConfigured } from "@kaneo/email";
import { readStoredSettings } from "../../instance-settings/read-stored-settings";
import {
  INTEGRATION_TYPES,
  resolveInstanceSettings,
} from "../../instance-settings/resolve-instance-settings";

/**
 * The effective settings (environment overrides applied), which ones an
 * environment variable locks, and the saved instance name (null = default).
 */
async function getAdminSettings() {
  const stored = await readStoredSettings();
  const effective = resolveInstanceSettings(stored, process.env);
  return {
    ...effective,
    instanceName: stored.instanceName,
    emailDeliveryConfigured: isSmtpConfigured(),
    integrationTypes: [...INTEGRATION_TYPES],
  };
}

export default getAdminSettings;
