import { describe, expect, it } from "vitest";
import { getAuditActionKey, getAuditEntryDetail } from "./audit-entry";

describe("getAuditActionKey", () => {
  it("maps known actions to i18n keys", () => {
    expect(getAuditActionKey("user.role_changed")).toBe(
      "settings:adminPanel.auditLog.actions.user_role_changed",
    );
  });

  it("returns null for unknown actions", () => {
    expect(getAuditActionKey("project.teleported")).toBeNull();
  });
});

describe("getAuditEntryDetail", () => {
  it("summarizes role changes", () => {
    expect(getAuditEntryDetail({ from: "user", to: "admin" })).toBe(
      "user → admin",
    );
  });

  it("summarizes revoked keys and counts", () => {
    expect(getAuditEntryDetail({ keyName: "CLI", keyStart: "kaneo_" })).toBe(
      "CLI · kaneo_…",
    );
    expect(getAuditEntryDetail({ count: 3 })).toBe("×3");
  });

  it("handles missing metadata", () => {
    expect(getAuditEntryDetail(null)).toBe("");
  });
});
