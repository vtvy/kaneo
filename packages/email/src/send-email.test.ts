import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { sendMail } = vi.hoisted(() => ({ sendMail: vi.fn() }));

vi.mock("nodemailer", () => ({
  createTransport: () => ({ sendMail }),
}));

import {
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

  it("reports SMTP as unconfigured when the password is missing", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_USER = "mailer@example.com";
    process.env.SMTP_FROM = "mailer@example.com";
    delete process.env.SMTP_PASSWORD;

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
