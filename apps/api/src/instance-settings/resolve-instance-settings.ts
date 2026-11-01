export const DEFAULT_INSTANCE_NAME = "Kaneo";

export const INTEGRATION_TYPES = [
  "github",
  "gitea",
  "gitlab",
  "generic-webhook",
  "discord",
  "slack",
  "telegram",
] as const;

/** What the `instance_settings` row holds, with defaults for a missing row. */
export type StoredInstanceSettings = {
  instanceName: string | null;
  registrationEnabled: boolean;
  passwordRegistrationEnabled: boolean;
  requireEmailVerification: boolean;
  workspaceCreationRestricted: boolean;
  disabledIntegrations: string[];
};

export type EnvLockedSetting =
  | "registrationEnabled"
  | "passwordRegistrationEnabled"
  | "requireEmailVerification"
  | "workspaceCreationRestricted";

export type InstanceSettings = Omit<StoredInstanceSettings, "instanceName"> & {
  instanceName: string;
  /** Settings forced by an environment variable, which wins over the database. */
  lockedByEnv: EnvLockedSetting[];
};

export const DEFAULT_STORED_SETTINGS: StoredInstanceSettings = {
  instanceName: null,
  registrationEnabled: true,
  passwordRegistrationEnabled: true,
  requireEmailVerification: false,
  workspaceCreationRestricted: false,
  disabledIntegrations: [],
};

type Env = Record<string, string | undefined>;

/**
 * Apply environment overrides. Only `"true"` locks a setting, always in the
 * restrictive direction: `DISABLE_REGISTRATION=true` wins over a database
 * value that enables registration, while `"false"` or unset defers to the
 * database.
 */
export function resolveInstanceSettings(
  stored: StoredInstanceSettings,
  env: Env,
): InstanceSettings {
  const locks: [EnvLockedSetting, boolean][] = [
    ["registrationEnabled", env.DISABLE_REGISTRATION === "true"],
    [
      "passwordRegistrationEnabled",
      env.DISABLE_PASSWORD_REGISTRATION === "true",
    ],
    ["requireEmailVerification", env.REQUIRE_EMAIL_VERIFICATION === "true"],
    ["workspaceCreationRestricted", env.DISABLE_WORKSPACE_CREATION === "true"],
  ];
  const lockedByEnv = locks.filter(([, on]) => on).map(([key]) => key);
  const locked = (key: EnvLockedSetting) => lockedByEnv.includes(key);

  return {
    instanceName: stored.instanceName?.trim() || DEFAULT_INSTANCE_NAME,
    registrationEnabled:
      !locked("registrationEnabled") && stored.registrationEnabled,
    passwordRegistrationEnabled:
      !locked("passwordRegistrationEnabled") &&
      stored.passwordRegistrationEnabled,
    requireEmailVerification:
      locked("requireEmailVerification") || stored.requireEmailVerification,
    workspaceCreationRestricted:
      locked("workspaceCreationRestricted") ||
      stored.workspaceCreationRestricted,
    disabledIntegrations: stored.disabledIntegrations,
    lockedByEnv,
  };
}
