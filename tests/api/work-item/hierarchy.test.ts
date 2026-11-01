import { describe, expect, it } from "vitest";
import {
  acceptsChild,
  validateHierarchy,
} from "../../../apps/api/src/work-item/hierarchy";

describe("work item hierarchy", () => {
  it("permits the agreed backlog hierarchy and Bug task children", () => {
    expect(acceptsChild("epic", "feature")).toBe(true);
    expect(acceptsChild("feature", "backlog_item")).toBe(true);
    expect(acceptsChild("backlog_item", "task")).toBe(true);
    expect(acceptsChild("bug", "task")).toBe(true);
    expect(acceptsChild("task", "task")).toBe(false);
  });
  it("allows existing standalone Tasks without converting them", () => {
    expect(
      validateHierarchy([], { id: "legacy", type: "task", parentId: null }),
    ).toBeNull();
  });
  it("rejects absent parents (including another project's ID)", () => {
    expect(
      validateHierarchy([], { id: "task", type: "task", parentId: "foreign" }),
    ).toBeTruthy();
  });
  it("rejects skipped levels and self-parenting", () => {
    const epic = { id: "epic", type: "epic", parentId: null };
    expect(
      validateHierarchy([epic], { id: "task", type: "task", parentId: "epic" }),
    ).toBeTruthy();
    expect(
      validateHierarchy([epic], { ...epic, parentId: "epic" }),
    ).toBeTruthy();
  });
  it("rejects changing type while children would become incompatible", () => {
    const parent = { id: "parent", type: "backlog_item", parentId: null };
    expect(
      validateHierarchy(
        [parent, { id: "child", type: "task", parentId: "parent" }],
        { ...parent, type: "feature" },
      ),
    ).toMatch(/child/);
  });
  it("rejects pre-existing corrupt ancestor cycles without hanging", () => {
    const items = [
      { id: "a", type: "backlog_item", parentId: "b" },
      { id: "b", type: "feature", parentId: "a" },
    ];
    expect(
      validateHierarchy(items, { id: "c", type: "task", parentId: "a" }),
    ).toMatch(/cycle/);
  });
});
