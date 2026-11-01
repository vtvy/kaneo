import { describe, expect, it } from "vitest";
import {
  isAllowedOrigin,
  resolveCorsOrigins,
} from "../../../apps/api/src/utils/cors-origins";

describe("resolveCorsOrigins", () => {
  it("prefers CORS_ORIGINS over KANEO_CLIENT_URL", () => {
    expect(
      resolveCorsOrigins({
        CORS_ORIGINS: "https://a.example, https://b.example",
        KANEO_CLIENT_URL: "https://c.example",
      }),
    ).toEqual(["https://a.example", "https://b.example"]);
  });

  it("falls back to KANEO_CLIENT_URL", () => {
    expect(
      resolveCorsOrigins({ CORS_ORIGINS: " ", KANEO_CLIENT_URL: "https://c" }),
    ).toEqual(["https://c"]);
  });

  it("is undefined when nothing is configured", () => {
    expect(resolveCorsOrigins({})).toBeUndefined();
  });
});

describe("isAllowedOrigin", () => {
  it("matches configured origins exactly", () => {
    const origins = ["https://kaneo.example"];
    expect(isAllowedOrigin("https://kaneo.example", origins)).toBe(true);
    expect(isAllowedOrigin("https://evil.example", origins)).toBe(false);
    // Configured lists are authoritative: localhost is not implicitly added.
    expect(isAllowedOrigin("http://localhost:5173", origins)).toBe(false);
  });

  it("allows only local dev origins when unconfigured", () => {
    expect(isAllowedOrigin("http://localhost:5173", undefined)).toBe(true);
    expect(isAllowedOrigin("http://127.0.0.1:3000", undefined)).toBe(true);
    expect(isAllowedOrigin("http://[::1]:5173", undefined)).toBe(true);
    expect(isAllowedOrigin("https://evil.example", undefined)).toBe(false);
    expect(isAllowedOrigin("http://localhost.evil.example", undefined)).toBe(
      false,
    );
    expect(isAllowedOrigin("null", undefined)).toBe(false);
    expect(isAllowedOrigin("file://localhost", undefined)).toBe(false);
  });

  it("allows the API's own host when unconfigured", () => {
    expect(
      isAllowedOrigin("https://kaneo.example", undefined, "kaneo.example"),
    ).toBe(true);
    expect(
      isAllowedOrigin("https://evil.example", undefined, "kaneo.example"),
    ).toBe(false);
  });
});
