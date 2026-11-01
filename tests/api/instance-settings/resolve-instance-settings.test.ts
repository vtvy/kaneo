import { describe, expect, it } from "vitest";
import { createAttemptLimiter } from "../../../apps/api/src/admin/system/attempt-limiter";
import {
  DEFAULT_STORED_SETTINGS,
  resolveInstanceSettings,
} from "../../../apps/api/src/instance-settings/resolve-instance-settings";

describe("resolveInstanceSettings", () => {
  it("uses the database when no environment override is set", () => {
    const result = resolveInstanceSettings(
      {
        ...DEFAULT_STORED_SETTINGS,
        registrationEnabled: false,
        instanceName: "  Acme  ",
      },
      { DISABLE_REGISTRATION: "false" },
    );
    expect(result.registrationEnabled).toBe(false);
    expect(result.instanceName).toBe("Acme");
    expect(result.lockedByEnv).toEqual([]);
  });

  it("lets env flags win in the restrictive direction", () => {
    const result = resolveInstanceSettings(DEFAULT_STORED_SETTINGS, {
      DISABLE_REGISTRATION: "true",
      DISABLE_PASSWORD_REGISTRATION: "true",
      REQUIRE_EMAIL_VERIFICATION: "true",
      DISABLE_WORKSPACE_CREATION: "true",
    });
    expect(result).toMatchObject({
      instanceName: "Kaneo",
      registrationEnabled: false,
      passwordRegistrationEnabled: false,
      requireEmailVerification: true,
      workspaceCreationRestricted: true,
    });
    expect(result.lockedByEnv).toHaveLength(4);
  });
});

describe("createAttemptLimiter", () => {
  it("allows max attempts per window, then reports retry-after", () => {
    let now = 0;
    const limiter = createAttemptLimiter({
      max: 2,
      windowMs: 10_000,
      now: () => now,
    });
    expect(limiter.take("a").allowed).toBe(true);
    expect(limiter.take("a").allowed).toBe(true);
    expect(limiter.take("a")).toEqual({
      allowed: false,
      retryAfterSeconds: 10,
    });
    expect(limiter.take("b").allowed).toBe(true);
    now = 10_001;
    expect(limiter.take("a").allowed).toBe(true);
  });
});
