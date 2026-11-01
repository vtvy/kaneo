import { and, eq } from "drizzle-orm";
import db from "../../database";
import { integrationTable } from "../../database/schema";
import { getInstanceSettings } from "../../instance-settings/get-instance-settings";
import { decryptSecret } from "../../utils/secret-box";

export const GOOGLE_DRIVE_INTEGRATION_TYPE = "google-drive";

// Stored in integration.config (JSON). The OAuth app credentials (clientId /
// clientSecret) are configured per project in the UI — no .env required. Both
// the clientSecret and the refreshToken are encrypted at rest.
export type GoogleDriveConfig = {
  // OAuth app credentials (set when the project saves its Google credentials).
  clientId?: string;
  clientSecret?: string; // encrypted
  redirectUri?: string; // optional override; otherwise derived from KANEO_API_URL
  // Connection state (set after the OAuth consent flow completes).
  refreshToken?: string; // encrypted
  accountEmail?: string;
  rootFolderId?: string;
  rootFolderName?: string;
  connectedBy?: string;
  scope?: string;
};

export type DriveIntegration = {
  id: string;
  isActive: boolean | null;
  config: GoogleDriveConfig;
  rawConfig: string;
};

export type DriveClientCreds = { clientId: string; clientSecret: string };

// Returns the Drive integration row in ANY state (credentials saved and/or
// connected), or null when there is no row / the config is unparseable.
export async function getDriveIntegrationRow(
  projectId: string,
): Promise<DriveIntegration | null> {
  const row = await db.query.integrationTable.findFirst({
    where: and(
      eq(integrationTable.projectId, projectId),
      eq(integrationTable.type, GOOGLE_DRIVE_INTEGRATION_TYPE),
    ),
  });
  if (!row) return null;
  let config: GoogleDriveConfig;
  try {
    config = JSON.parse(row.config) as GoogleDriveConfig;
  } catch {
    return null;
  }
  return { id: row.id, isActive: row.isActive, config, rawConfig: row.config };
}

// Returns the Drive integration only when fully connected (refresh token
// present). Used by the document providers that actually talk to Drive.
export async function getDriveIntegration(
  projectId: string,
): Promise<DriveIntegration | null> {
  if (
    (await getInstanceSettings()).disabledIntegrations.includes(
      GOOGLE_DRIVE_INTEGRATION_TYPE,
    )
  )
    return null;
  const integration = await getDriveIntegrationRow(projectId);
  if (!integration || integration.isActive === false) return null;
  if (!integration.config.refreshToken) return null;
  return integration;
}

export function getRefreshToken(config: GoogleDriveConfig): string {
  if (!config.refreshToken) {
    throw new Error("Google Drive is not connected for this project.");
  }
  return decryptSecret(config.refreshToken);
}

// Decrypts and returns the project's OAuth app credentials (clientId is stored
// in plaintext; clientSecret is encrypted at rest).
export function getClientCreds(config: GoogleDriveConfig): DriveClientCreds {
  if (!config.clientId || !config.clientSecret) {
    throw new Error(
      "Google Drive credentials are not configured for this project.",
    );
  }
  return {
    clientId: config.clientId,
    clientSecret: decryptSecret(config.clientSecret),
  };
}

export function isConfigured(config: GoogleDriveConfig): boolean {
  return Boolean(config.clientId && config.clientSecret);
}
