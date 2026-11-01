import { beforeEach, describe, expect, it, vi } from "vitest";

const { verify, sendMail, close } = vi.hoisted(() => ({
  verify: vi.fn(),
  sendMail: vi.fn(),
  close: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  createTransport: () => ({ verify, sendMail, close }),
}));

import {
  getSmtpErrorDetails,
  sendTestEmail,
  verifySmtpConnection,
} from "./smtp-check";

const env = {
  SMTP_HOST: "smtp.example.com",
  SMTP_PORT: "587",
  SMTP_FROM: "kaneo@example.com",
  SMTP_USER: "mailer",
  SMTP_PASSWORD: "super-secret",
};

describe("verifySmtpConnection", () => {
  beforeEach(() => {
    verify.mockReset();
    close.mockReset();
  });

  it("reports not_configured without connecting", async () => {
    await expect(verifySmtpConnection(1000, {})).resolves.toEqual({
      status: "not_configured",
    });
    expect(verify).not.toHaveBeenCalled();
  });

  it("returns only the error category, never the server message", async () => {
    verify.mockRejectedValueOnce(
      Object.assign(new Error("535 auth failed for mailer:super-secret"), {
        code: "EAUTH",
        responseCode: 535,
      }),
    );
    const result = await verifySmtpConnection(1000, env);
    expect(result).toEqual({
      status: "failed",
      code: "EAUTH",
      responseCode: 535,
    });
    expect(JSON.stringify(result)).not.toContain("super-secret");
    expect(close).toHaveBeenCalled();
  });

  it("reports ok when the server accepts the connection", async () => {
    verify.mockResolvedValueOnce(true);
    await expect(verifySmtpConnection(1000, env)).resolves.toEqual({
      status: "ok",
    });
  });
});

describe("sendTestEmail", () => {
  it("sends to the given recipient", async () => {
    sendMail.mockResolvedValueOnce({});
    await expect(
      sendTestEmail("admin@example.com", "Test", env),
    ).resolves.toEqual({ success: true });
    expect(sendMail.mock.calls[0]?.[0]).toMatchObject({
      to: "admin@example.com",
      from: "kaneo@example.com",
    });
  });
});

describe("getSmtpErrorDetails", () => {
  it("drops unexpected codes", () => {
    expect(getSmtpErrorDetails({ code: "x y secret" })).toEqual({
      code: "UNKNOWN",
    });
  });
});
