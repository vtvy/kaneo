import { isSmtpConfigured } from "@kaneo/email";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { instanceSettingsTable } from "../../database/schema";
import { invalidateInstanceSettings } from "../../instance-settings/get-instance-settings";
import {
  INSTANCE_SETTINGS_ID,
  readStoredSettings,
} from "../../instance-settings/read-stored-settings";
import {
  INTEGRATION_TYPES,
  resolveInstanceSettings,
} from "../../instance-settings/resolve-instance-settings";
import type { AdminAuditRequest } from "../audit/admin-audit-request";
import { recordAdminAction } from "../audit/record-admin-action";
import getAdminSettings from "./get-admin-settings";

export type UpdateAdminSettingsInput = {
  instanceName?: string | null;
  registrationEnabled?: boolean;
  passwordRegistrationEnabled?: boolean;
  requireEmailVerification?: boolean;
  workspaceCreationRestricted?: boolean;
  disabledIntegrations?: string[];
};

// Setting names go in values, not keys: the audit sanitizer drops keys that
// look like credentials, such as `passwordRegistrationEnabled`.
type Change = { setting: string; from: unknown; to: unknown };

/** Save the changed settings and record which ones changed. */
async function updateAdminSettings(
  audit: AdminAuditRequest,
  input: UpdateAdminSettingsInput,
) {
  const { lockedByEnv } = resolveInstanceSettings(
    await readStoredSettings(),
    process.env,
  );
  for (const key of lockedByEnv) {
    if (input[key] !== undefined) {
      throw new HTTPException(409, {
        message: `An environment variable sets "${key}"; change it there.`,
      });
    }
  }
  if (input.requireEmailVerification === true && !isSmtpConfigured()) {
    throw new HTTPException(400, {
      message: "Email verification needs SMTP to be configured.",
    });
  }
  const known = new Set<string>(INTEGRATION_TYPES);
  const disabledIntegrations = input.disabledIntegrations
    ? [...new Set(input.disabledIntegrations)].sort()
    : undefined;
  if (disabledIntegrations?.some((type) => !known.has(type))) {
    throw new HTTPException(400, { message: "Unknown integration type." });
  }
  const instanceName =
    input.instanceName === undefined
      ? undefined
      : input.instanceName?.trim() || null;

  const next = {
    instanceName,
    registrationEnabled: input.registrationEnabled,
    passwordRegistrationEnabled: input.passwordRegistrationEnabled,
    requireEmailVerification: input.requireEmailVerification,
    workspaceCreationRestricted: input.workspaceCreationRestricted,
    disabledIntegrations,
  };

  await db.transaction(async (tx) => {
    await tx
      .insert(instanceSettingsTable)
      .values({ id: INSTANCE_SETTINGS_ID })
      .onConflictDoNothing();
    await tx
      .select({ id: instanceSettingsTable.id })
      .from(instanceSettingsTable)
      .where(eq(instanceSettingsTable.id, INSTANCE_SETTINGS_ID))
      .for("update");
    const current = await readStoredSettings(tx);

    const changes: Change[] = [];
    for (const [setting, to] of Object.entries(next)) {
      if (to === undefined) continue;
      const from = current[setting as keyof typeof current];
      if (JSON.stringify(from) !== JSON.stringify(to)) {
        changes.push({ setting, from, to });
      }
    }
    if (changes.length === 0) return;

    await tx
      .update(instanceSettingsTable)
      .set(next)
      .where(eq(instanceSettingsTable.id, INSTANCE_SETTINGS_ID));
    await recordAdminAction(
      audit,
      {
        action: "instance.settings_updated",
        targetType: "instance",
        metadata: { changes },
      },
      tx,
    );
  });
  invalidateInstanceSettings();
  return getAdminSettings();
}

export default updateAdminSettings;
