import { describe, expect, it } from "vitest";
import { filterMentionMembers, getMentionableMembers } from "./mention-members";

const workspaceMembers = [
  { userId: "u-owner", role: "owner", user: { name: "Olivia" } },
  { userId: "u-admin", role: "admin", user: { name: "Adam" } },
  { userId: "u-member", role: "member", user: { name: "Mia" } },
  {
    userId: "u-outsider",
    role: "member",
    user: { name: null, email: "out@example.com" },
  },
];

describe("getMentionableMembers", () => {
  it("offers all workspace members when project members are unknown", () => {
    expect(getMentionableMembers(workspaceMembers).map((m) => m.id)).toEqual([
      "u-admin",
      "u-member",
      "u-owner",
      "u-outsider",
    ]);
  });

  it("keeps owners/admins and project members only", () => {
    const ids = getMentionableMembers(workspaceMembers, ["u-member"]).map(
      (m) => m.id,
    );
    expect(ids.sort()).toEqual(["u-admin", "u-member", "u-owner"]);
  });

  it("falls back to email, then id, for the label", () => {
    const [member] = getMentionableMembers([
      { userId: "u-1", user: { name: "", email: "x@example.com" } },
    ]);
    expect(member).toEqual({ id: "u-1", label: "x@example.com", image: null });
    expect(getMentionableMembers([{ userId: "u-2" }])[0]?.label).toBe("u-2");
  });
});

describe("filterMentionMembers", () => {
  const members = getMentionableMembers(workspaceMembers);

  it("matches case-insensitively on the label", () => {
    expect(filterMentionMembers(members, "MI").map((m) => m.id)).toEqual([
      "u-member",
    ]);
  });

  it("returns everyone (up to the limit) for an empty query", () => {
    expect(filterMentionMembers(members, "")).toHaveLength(4);
    expect(filterMentionMembers(members, "", 2)).toHaveLength(2);
  });
});
