import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { sendMail } = vi.hoisted(() => ({ sendMail: vi.fn() }));
vi.mock("nodemailer", () => ({ createTransport: () => ({ sendMail }) }));

import { sendFeedbackEmail } from "./send-email";

beforeEach(() => {
  sendMail.mockReset();
  vi.stubEnv("SMTP_HOST", "smtp.example.com");
  vi.stubEnv("SMTP_PORT", "25");
  vi.stubEnv("SMTP_FROM", "kaneo@example.com");
});
afterEach(() => vi.unstubAllEnvs());

describe("feedback email", () => {
  it("escapes user text and keeps sender input on one header line", async () => {
    sendMail.mockResolvedValue({});
    await sendFeedbackEmail("feedback@example.com", {
      senderName: "User\r\nBcc: victim@example.com",
      senderEmail: "user@example.com",
      message: '<script>alert("x")</script>',
      pageUrl: "javascript:alert(1)",
    });
    const mail = sendMail.mock.calls[0][0];
    expect(mail.to).toBe("feedback@example.com");
    expect(mail.subject).not.toMatch(/[\r\n]/);
    expect(mail.html).toContain("&lt;script&gt;");
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).not.toContain("javascript:");
    expect(mail.replyTo).toBe("user@example.com");
  });

  it("does not attempt SMTP when configuration is missing", async () => {
    vi.stubEnv("SMTP_HOST", "");
    expect(
      await sendFeedbackEmail("feedback@example.com", {
        senderName: "User",
        senderEmail: "user@example.com",
        message: "Suggestion",
      }),
    ).toEqual({ success: false, reason: "SMTP_NOT_CONFIGURED" });
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("reports delivery failures to its caller", async () => {
    sendMail.mockRejectedValue(new Error("SMTP down"));
    await expect(
      sendFeedbackEmail("feedback@example.com", {
        senderName: "User",
        senderEmail: "user@example.com",
        message: "Suggestion",
      }),
    ).rejects.toThrow("SMTP down");
  });
});
