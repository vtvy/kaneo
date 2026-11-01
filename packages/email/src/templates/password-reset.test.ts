import { render } from "@react-email/render";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import PasswordResetEmail from "./password-reset";

const resetLink = "https://kaneo.app/auth/reset-password?token=abc";

describe("PasswordResetEmail", () => {
  it("renders English copy by default", async () => {
    const html = await render(
      createElement(PasswordResetEmail, { resetLink, userName: "Jane" }),
    );
    expect(html).toContain(resetLink);
    expect(html).toContain("Hi Jane, use the button below");
  });

  it("renders German copy for a de-DE locale", async () => {
    const html = await render(
      createElement(PasswordResetEmail, { resetLink, locale: "de-DE" }),
    );
    expect(html).toContain("Passwort zuruecksetzen");
  });

  it("renders Vietnamese copy for a vi-VN locale", async () => {
    const html = await render(
      createElement(PasswordResetEmail, { resetLink, locale: "vi-VN" }),
    );
    expect(html).toContain("Đặt lại mật khẩu của bạn");
  });

  it("falls back to English for unsupported locales", async () => {
    const html = await render(
      createElement(PasswordResetEmail, { resetLink, locale: "ko-KR" }),
    );
    expect(html).toContain("Reset your password");
  });
});
