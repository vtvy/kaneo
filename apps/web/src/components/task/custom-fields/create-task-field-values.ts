import type { CustomFieldDefinition } from "@/components/project/custom-fields/types";
import { parseMultiselect } from "./parse-multiselect";

// Values typed in the create-task form, keyed by field id. Fields the user
// hasn't touched show (and get, server side) their default.
export type CreateTaskFieldValues = Record<string, string>;

type Field = Pick<
  CustomFieldDefinition,
  "id" | "name" | "type" | "required" | "defaultValue"
>;

export function displayedFieldValue(
  field: Field,
  values: CreateTaskFieldValues,
): string {
  return values[field.id] ?? field.defaultValue ?? "";
}

function isEmptyValue(type: Field["type"], value: string): boolean {
  if (!value.trim()) return true;
  return type === "multiselect" && parseMultiselect(value).length === 0;
}

export function missingRequiredFields(
  fields: Field[],
  values: CreateTaskFieldValues,
): string[] {
  return fields
    .filter(
      (field) =>
        field.required &&
        isEmptyValue(field.type, displayedFieldValue(field, values)),
    )
    .map((field) => field.name);
}

// Only touched fields are sent; the API fills defaults for the rest.
export function toCustomFieldPayload(
  fields: Field[],
  values: CreateTaskFieldValues,
): { fieldId: string; value: string }[] {
  return fields
    .filter((field) => values[field.id] !== undefined)
    .map((field) => ({ fieldId: field.id, value: values[field.id] ?? "" }));
}
