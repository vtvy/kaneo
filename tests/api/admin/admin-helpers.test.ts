import { describe, expect, it } from "vitest";
import { sanitizeAuditMetadata } from "../../../apps/api/src/admin/audit/sanitize-audit-metadata";
import { escapeLikePattern } from "../../../apps/api/src/admin/users/escape-like";
import { isBanActive } from "../../../apps/api/src/admin/users/is-ban-active";

describe("sanitizeAuditMetadata", () => {
  it("drops keys that look like credentials at any depth", () => {
    expect(
      sanitizeAuditMetadata({
        role: "admin",
        password: "hunter2",
        apiKey: "kaneo_123",
        key: "raw",
        nested: { sessionToken: "t", keep: 1, cookie: "c" },
      }),
    ).toEqual({ role: "admin", nested: { keep: 1 } });
  });

  it("keeps identifier keys that are not secrets", () => {
    expect(
      sanitizeAuditMetadata({ keyId: "k1", keyStart: "kan", sessionId: "s" }),
    ).toEqual({ keyId: "k1", keyStart: "kan", sessionId: "s" });
  });

  it("serializes dates and drops undefined values", () => {
    const date = new Date("2026-01-02T03:04:05.000Z");
    expect(sanitizeAuditMetadata({ at: date, gone: undefined })).toEqual({
      at: "2026-01-02T03:04:05.000Z",
    });
  });

  it("caps nesting depth", () => {
    expect(sanitizeAuditMetadata({ a: { b: { c: { d: { e: 1 } } } } })).toEqual(
      { a: { b: { c: { d: {} } } } },
    );
  });
});

describe("isBanActive", () => {
  const now = new Date("2026-06-01T00:00:00Z");

  it("is false when not banned", () => {
    expect(isBanActive({ banned: false, banExpires: null }, now)).toBe(false);
    expect(isBanActive({ banned: null, banExpires: null }, now)).toBe(false);
  });

  it("is true for permanent and unexpired bans", () => {
    expect(isBanActive({ banned: true, banExpires: null }, now)).toBe(true);
    expect(
      isBanActive(
        { banned: true, banExpires: new Date("2026-07-01T00:00:00Z") },
        now,
      ),
    ).toBe(true);
  });

  it("is false once the ban expired", () => {
    expect(
      isBanActive(
        { banned: true, banExpires: new Date("2026-05-01T00:00:00Z") },
        now,
      ),
    ).toBe(false);
  });
});

describe("escapeLikePattern", () => {
  it("escapes LIKE wildcards", () => {
    expect(escapeLikePattern("50%_off\\")).toBe("50\\%\\_off\\\\");
  });
});
