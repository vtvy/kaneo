import { describe, expect, it } from "vitest";
import { isHttpUrl } from "../../../apps/api/src/external-link/http-url";

describe("isHttpUrl", () => {
  it("accepts http and https, including uppercase schemes", () => {
    expect(isHttpUrl("https://example.com/a")).toBe(true);
    expect(isHttpUrl("HTTP://example.com")).toBe(true);
  });

  it("rejects other schemes and text that is not a URL", () => {
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("not a url")).toBe(false);
  });
});
