import { eq } from "drizzle-orm";
import db from "../database";
import { instanceSettingsTable } from "../database/schema";
import {
  DEFAULT_STORED_SETTINGS,
  type StoredInstanceSettings,
} from "./resolve-instance-settings";

export const INSTANCE_SETTINGS_ID = "instance";

type Database = typeof db;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export async function readStoredSettings(
  database: Database | Transaction = db,
): Promise<StoredInstanceSettings> {
  const [row] = await database
    .select({
      instanceName: instanceSettingsTable.instanceName,
      registrationEnabled: instanceSettingsTable.registrationEnabled,
      passwordRegistrationEnabled:
        instanceSettingsTable.passwordRegistrationEnabled,
      requireEmailVerification: instanceSettingsTable.requireEmailVerification,
      workspaceCreationRestricted:
        instanceSettingsTable.workspaceCreationRestricted,
      disabledIntegrations: instanceSettingsTable.disabledIntegrations,
    })
    .from(instanceSettingsTable)
    .where(eq(instanceSettingsTable.id, INSTANCE_SETTINGS_ID))
    .limit(1);
  return row ?? { ...DEFAULT_STORED_SETTINGS };
}
