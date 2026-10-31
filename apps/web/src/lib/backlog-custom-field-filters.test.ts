import { describe, expect, it } from "vitest";
import {
  customFieldFilterOptions,
  EMPTY_FIELD_VALUE,
  indexCustomFieldValues,
  isFilterableCustomField,
  matchesCustomFieldFilters,
  normalizeCustomFieldFilters,
  toggleCustomFieldFilter,
} from "./backlog-custom-field-filters";

const stage = {
  id: "stage",
  type: "dropdown" as const,
  options: ["Design", "Build"],
};
const tags = {
  id: "tags",
  type: "multiselect" as const,
  options: ["ui", "api"],
};
const done = { id: "done", type: "boolean" as const, options: null };
const note = { id: "note", type: "text" as const, options: null };
const fields = [stage, tags, done, note];

const values = indexCustomFieldValues([
  { taskId: "a", fieldId: "stage", value: "Build" },
  { taskId: "a", fieldId: "tags", value: '["ui","api"]' },
  { taskId: "a", fieldId: "done", value: "true" },
  { taskId: "b", fieldId: "stage", value: "" },
  { taskId: "b", fieldId: "tags", value: "[]" },
]);

const matches = (taskId: string, filters: Record<string, string[]>) =>
  matchesCustomFieldFilters(values.get(taskId), filters, fields);

describe("backlog custom field filters", () => {
  it("offers select, multi-select and checkbox fields only", () => {
    expect(fields.filter(isFilterableCustomField).map((f) => f.id)).toEqual([
      "stage",
      "tags",
      "done",
    ]);
    expect(customFieldFilterOptions(stage)).toEqual([
      "Design",
      "Build",
      EMPTY_FIELD_VALUE,
    ]);
    expect(customFieldFilterOptions(done)).toEqual(["true", "false"]);
    expect(customFieldFilterOptions(note)).toEqual([]);
  });

  it("matches dropdown values and the empty option", () => {
    expect(matches("a", { stage: ["Build"] })).toBe(true);
    expect(matches("a", { stage: ["Design"] })).toBe(false);
    expect(matches("b", { stage: [EMPTY_FIELD_VALUE] })).toBe(true);
    expect(matches("c", { stage: [EMPTY_FIELD_VALUE] })).toBe(true);
    expect(matches("c", { stage: ["Build"] })).toBe(false);
  });

  it("matches a multi-select when any picked option is selected", () => {
    expect(matches("a", { tags: ["api"] })).toBe(true);
    expect(matches("a", { tags: [EMPTY_FIELD_VALUE] })).toBe(false);
    expect(matches("b", { tags: [EMPTY_FIELD_VALUE] })).toBe(true);
  });

  it("treats an unset checkbox as unchecked", () => {
    expect(matches("a", { done: ["true"] })).toBe(true);
    expect(matches("b", { done: ["false"] })).toBe(true);
    expect(matches("b", { done: ["true"] })).toBe(false);
  });

  it("requires every filtered field and ignores unknown fields", () => {
    expect(matches("a", { stage: ["Build"], done: ["false"] })).toBe(false);
    expect(matches("a", { stage: ["Build"], gone: ["x"] })).toBe(true);
    expect(matches("a", { note: ["x"] })).toBe(true);
  });

  it("normalizes persisted state and toggles values", () => {
    expect(
      normalizeCustomFieldFilters({ stage: ["Build", 3], tags: [], x: "y" }),
    ).toEqual({ stage: ["Build"] });
    expect(normalizeCustomFieldFilters(["stage"])).toEqual({});
    const once = toggleCustomFieldFilter({}, "stage", "Build");
    expect(once).toEqual({ stage: ["Build"] });
    expect(toggleCustomFieldFilter(once, "stage", "Build")).toEqual({});
  });
});
