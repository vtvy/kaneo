import { describe, expect, it } from "vitest";
import {
  displayedFieldValue,
  missingRequiredFields,
  toCustomFieldPayload,
} from "./create-task-field-values";

const fields = [
  {
    id: "stage",
    name: "Stage",
    type: "dropdown" as const,
    required: true,
    defaultValue: null,
  },
  {
    id: "tags",
    name: "Tags",
    type: "multiselect" as const,
    required: true,
    defaultValue: '["ui"]',
  },
  {
    id: "note",
    name: "Note",
    type: "text" as const,
    required: false,
    defaultValue: "hi",
  },
];

describe("create task field values", () => {
  it("shows defaults until the user edits a field", () => {
    expect(displayedFieldValue(fields[2], {})).toBe("hi");
    expect(displayedFieldValue(fields[2], { note: "" })).toBe("");
  });

  it("lists required fields left empty", () => {
    expect(missingRequiredFields(fields, {})).toEqual(["Stage"]);
    expect(missingRequiredFields(fields, { stage: "A", tags: "[]" })).toEqual([
      "Tags",
    ]);
    expect(missingRequiredFields(fields, { stage: "A" })).toEqual([]);
  });

  it("sends only touched fields", () => {
    expect(toCustomFieldPayload(fields, { note: "", stage: "A" })).toEqual([
      { fieldId: "stage", value: "A" },
      { fieldId: "note", value: "" },
    ]);
    expect(toCustomFieldPayload(fields, { gone: "x" })).toEqual([]);
  });
});
