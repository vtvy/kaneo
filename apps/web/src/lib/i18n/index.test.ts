import { describe, expect, it } from "vitest";
import { i18n, resolveLocale } from "./index";

describe("resolveLocale", () => {
  it.each([
    ["vi", "vi-VN"],
    ["VI-vn", "vi-VN"],
    ["ko", "ko-KR"],
    ["en-GB", "en-US"],
  ])("resolves %s to %s", (preferred, expected) => {
    expect(resolveLocale(preferred, "ja-JP")).toBe(expected);
  });

  it("uses the browser locale when no preference is set", () => {
    expect(resolveLocale(null, "vi-VN")).toBe("vi-VN");
  });

  it("falls back to English for an unsupported language", () => {
    expect(resolveLocale(null, "ja-JP")).toBe("en-US");
  });
});

describe("vi-VN resources", () => {
  it("serves Vietnamese copy", async () => {
    await i18n.changeLanguage("vi-VN");
    expect(i18n.t("common:actions.cancel")).toBe("Hủy");
    await i18n.changeLanguage("en-US");
  });
});
