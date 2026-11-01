import { describe, expect, it } from "vitest";
import {
  can,
  canAssignTask,
  canEditOwnComment,
  type ProjectAccess,
  parseProjectAccess,
} from "./permissions";

const viewer: ProjectAccess = {
  isOwner: false,
  statements: {
    item: ["read"],
    backlog: ["read"],
    doc: ["view"],
  },
};

const member: ProjectAccess = {
  isOwner: false,
  statements: {
    item: ["create", "read", "update", "transition", "assign"],
    doc: ["view", "upload", "manage"],
    sprint: ["manage"],
  },
};

describe("parseProjectAccess", () => {
  it("reads the project-rbac me payload", () => {
    expect(
      parseProjectAccess({
        isOwner: false,
        statements: { item: ["read"], doc: ["view"], ignored: "nope" },
      }),
    ).toEqual({
      isOwner: false,
      statements: { item: ["read"], doc: ["view"] },
    });
  });

  it("does not treat a missing payload as owner", () => {
    expect(parseProjectAccess(null)).toEqual({
      isOwner: false,
      statements: {},
    });
  });
});

describe("can", () => {
  it("hides mutations from a viewer and allows read", () => {
    expect(can(viewer, "item", "read")).toBe(true);
    expect(can(viewer, "item", "create")).toBe(false);
    expect(can(viewer, "item", "update")).toBe(false);
    expect(can(viewer, "item", "delete")).toBe(false);
    expect(can(viewer, "item", "transition")).toBe(false);
    expect(can(viewer, "item", "assign")).toBe(false);
    expect(can(viewer, "doc", "view")).toBe(true);
    expect(can(viewer, "doc", "upload")).toBe(false);
  });

  it("allows the actions a member role grants", () => {
    expect(can(member, "item", "create")).toBe(true);
    expect(can(member, "item", "transition")).toBe(true);
    expect(can(member, "doc", "upload")).toBe(true);
    expect(can(member, "item", "delete")).toBe(false);
  });

  it("treats an owner as allowed and unknown access as denied", () => {
    expect(can({ isOwner: true, statements: {} }, "item", "delete")).toBe(true);
    expect(can(null, "item", "read")).toBe(false);
    expect(can(undefined, "doc", "view")).toBe(false);
  });
});

describe("canAssignTask", () => {
  it("lets the reporter assign without item:assign", () => {
    expect(canAssignTask(viewer, "user-1", "user-1")).toBe(true);
    expect(canAssignTask(viewer, "user-1", "user-2")).toBe(false);
  });

  it("hides assign while permissions are unknown", () => {
    expect(canAssignTask(null, "user-1", "user-1")).toBe(false);
  });
});

describe("canEditOwnComment", () => {
  it("allows only the author", () => {
    expect(canEditOwnComment("user-1", "user-1")).toBe(true);
    expect(canEditOwnComment("user-1", "user-2")).toBe(false);
    expect(canEditOwnComment(null, "user-1")).toBe(false);
  });
});
