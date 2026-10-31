import { afterEach, beforeEach, describe, expect, it } from "vitest";
import getSettings from "../../../apps/api/src/utils/get-settings";

const SMTP_KEYS = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "SMTP_FROM",
] as const;

describe("getSettings().hasSmtp", () => {
  const saved: Partial<Record<(typeof SMTP_KEYS)[number], string>> = {};

  beforeEach(() => {
    for (const key of SMTP_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of SMTP_KEYS) {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    }
  });

  it("treats an auth-less relay without SMTP_SECURE as configured", () => {
    process.env.SMTP_HOST = "relay.internal";
    process.env.SMTP_PORT = "25";
    process.env.SMTP_FROM = "kaneo@example.com";

    expect(getSettings().hasSmtp).toBe(true);
  });

  it("is false without a host, port or sender", () => {
    process.env.SMTP_PORT = "25";
    process.env.SMTP_FROM = "kaneo@example.com";
    process.env.SMTP_USER = "mailer";
    process.env.SMTP_PASSWORD = "secret";
    expect(getSettings().hasSmtp).toBe(false);

    process.env.SMTP_HOST = "relay.internal";
    delete process.env.SMTP_FROM;
    expect(getSettings().hasSmtp).toBe(false);
  });
});
