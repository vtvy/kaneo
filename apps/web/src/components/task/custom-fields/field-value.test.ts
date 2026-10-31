import { describe, expect, it } from "vitest";
import {
  formatFieldValue,
  selectableOptions,
  toggleMultiselectValue,
} from "./field-value";

describe("selectableOptions", () => {
  const field = {
    type: "dropdown" as const,
    options: ["Web", "iOS", "Android"],
    hiddenOptions: ["iOS"],
  };

  it("leaves out hidden options", () => {
    expect(selectableOptions(field, "Web")).toEqual(["Web", "Android"]);
  });

  it("keeps a hidden option the task already uses", () => {
    expect(selectableOptions(field, "iOS")).toEqual(["Web", "iOS", "Android"]);
    expect(
      selectableOptions({ ...field, type: "multiselect" }, '["iOS"]'),
    ).toEqual(["Web", "iOS", "Android"]);
  });
});

describe("toggleMultiselectValue", () => {
  const options = ["a", "b", "c"];

  it("adds options in field order", () => {
    expect(toggleMultiselectValue('["c"]', "a", options)).toBe('["a","c"]');
  });

  it("clears the value when the last option is removed", () => {
    expect(toggleMultiselectValue('["a"]', "a", options)).toBe("");
  });
});

describe("formatFieldValue", () => {
  it("joins multiselect values", () => {
    expect(formatFieldValue("multiselect", '["a","b"]')).toBe("a, b");
    expect(formatFieldValue("text", null)).toBe("");
  });
});
