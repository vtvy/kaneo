import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { sendMail } = vi.hoisted(() => ({ sendMail: vi.fn() }));

vi.mock("nodemailer", () => ({
  createTransport: () => ({ sendMail }),
}));

import {
  getSmtpAuth,
  isSmtpConfigured,
  sendPasswordResetEmail,
  sendWorkspaceInvitationEmail,
} from "./send-email";

describe("sendPasswordResetEmail", () => {
  beforeEach(() => {
    sendMail.mockReset();
  });

  it("rethrows transport failures so callers can record them", async () => {
    sendMail.mockRejectedValueOnce(new Error("smtp down"));

    await expect(
      sendPasswordResetEmail("user@example.com", "Reset your password", {
        resetLink: "https://example.com/reset?token=abc",
        userName: "User",
      }),
    ).rejects.toThrow("smtp down");
  });

  it("resolves when the transport accepts the message", async () => {
    sendMail.mockResolvedValueOnce({ accepted: ["user@example.com"] });

    await expect(
      sendPasswordResetEmail("user@example.com", "Reset your password", {
        resetLink: "https://example.com/reset?token=abc",
        userName: "User",
      }),
    ).resolves.toBeUndefined();

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "user@example.com" }),
    );
  });
});

describe("sendWorkspaceInvitationEmail", () => {
  const SMTP_KEYS = [
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_USER",
    "SMTP_PASSWORD",
    "SMTP_FROM",
  ] as const;
  const saved: Partial<Record<(typeof SMTP_KEYS)[number], string>> = {};

  beforeEach(() => {
    sendMail.mockReset();
    for (const key of SMTP_KEYS) {
      saved[key] = process.env[key];
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

  it("reports SMTP as unconfigured when the host is missing", async () => {
    delete process.env.SMTP_HOST;
    process.env.SMTP_PORT = "587";
    process.env.SMTP_USER = "mailer@example.com";
    process.env.SMTP_PASSWORD = "secret";
    process.env.SMTP_FROM = "mailer@example.com";

    const result = await sendWorkspaceInvitationEmail(
      "user@example.com",
      "Invitation",
      {
        workspaceName: "Workspace",
        inviterName: "Inviter",
        invitationLink: "https://example.com/invite",
        to: "user@example.com",
      },
    );

    expect(result).toEqual({
      success: false,
      reason: "SMTP_NOT_CONFIGURED",
    });
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("sends when SMTP is fully configured", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_USER = "mailer@example.com";
    process.env.SMTP_PASSWORD = "secret";
    process.env.SMTP_FROM = "mailer@example.com";
    sendMail.mockResolvedValueOnce({ accepted: ["user@example.com"] });

    const result = await sendWorkspaceInvitationEmail(
      "user@example.com",
      "Invitation",
      {
        workspaceName: "Workspace",
        inviterName: "Inviter",
        invitationLink: "https://example.com/invite",
        to: "user@example.com",
      },
    );

    expect(result).toEqual({ success: true });
  });
});

describe("isSmtpConfigured", () => {
  it("accepts a relay without credentials or SMTP_SECURE", () => {
    expect(
      isSmtpConfigured({
        SMTP_HOST: "relay.internal",
        SMTP_PORT: "25",
        SMTP_FROM: "kaneo@example.com",
      }),
    ).toBe(true);
  });

  it("requires host, port and sender", () => {
    expect(
      isSmtpConfigured({ SMTP_PORT: "25", SMTP_FROM: "kaneo@example.com" }),
    ).toBe(false);
    expect(
      isSmtpConfigured({
        SMTP_HOST: "relay.internal",
        SMTP_FROM: "kaneo@example.com",
      }),
    ).toBe(false);
    expect(
      isSmtpConfigured({ SMTP_HOST: "relay.internal", SMTP_PORT: "25" }),
    ).toBe(false);
  });
});

describe("getSmtpAuth", () => {
  it("omits auth when no user is configured", () => {
    expect(getSmtpAuth({})).toBeUndefined();
    expect(getSmtpAuth({ SMTP_PASSWORD: "orphan" })).toBeUndefined();
  });

  it("passes credentials when a user is configured", () => {
    expect(
      getSmtpAuth({ SMTP_USER: "mailer", SMTP_PASSWORD: "secret" }),
    ).toEqual({ user: "mailer", pass: "secret" });
  });
});
