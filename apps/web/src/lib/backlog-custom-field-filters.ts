import type { CustomFieldDefinition } from "@/components/project/custom-fields/types";
import { parseMultiselect } from "@/components/task/custom-fields/parse-multiselect";

// Selected filter values per custom field id, like upstream's board filters.
export type CustomFieldFilterState = Record<string, string[]>;

// Matches tasks with no value for the field.
export const EMPTY_FIELD_VALUE = "__empty__";

type Field = Pick<CustomFieldDefinition, "id" | "type" | "options">;

export function isFilterableCustomField(field: Pick<Field, "type">) {
  return (
    field.type === "dropdown" ||
    field.type === "multiselect" ||
    field.type === "boolean"
  );
}

// Values offered in a field's filter menu, "no value" last for choice fields.
// Boolean "false" also matches tasks whose box was never ticked.
export function customFieldFilterOptions(field: Field): string[] {
  if (field.type === "boolean") return ["true", "false"];
  if (field.type === "dropdown" || field.type === "multiselect") {
    return [...(field.options ?? []), EMPTY_FIELD_VALUE];
  }
  return [];
}

function picked(field: Field, raw: string | null | undefined): string[] {
  const value = raw?.trim() ?? "";
  if (field.type === "boolean") return [value === "true" ? "true" : "false"];
  if (field.type === "multiselect") {
    const options = parseMultiselect(value);
    return options.length > 0 ? options : [EMPTY_FIELD_VALUE];
  }
  return value ? [value] : [EMPTY_FIELD_VALUE];
}

export type TaskFieldValues = Map<string, Map<string, string | null>>;

export function indexCustomFieldValues(
  values: Array<{ taskId: string; fieldId: string; value: string | null }>,
): TaskFieldValues {
  const byTask: TaskFieldValues = new Map();
  for (const entry of values) {
    let fields = byTask.get(entry.taskId);
    if (!fields) {
      fields = new Map();
      byTask.set(entry.taskId, fields);
    }
    fields.set(entry.fieldId, entry.value);
  }
  return byTask;
}

// A task passes when, for every filtered field, one of its values is selected.
// Filters on fields that no longer exist (or can't be filtered) are ignored.
export function matchesCustomFieldFilters(
  taskValues: Map<string, string | null> | undefined,
  filters: CustomFieldFilterState,
  fields: Field[],
): boolean {
  for (const [fieldId, wanted] of Object.entries(filters)) {
    if (wanted.length === 0) continue;
    const field = fields.find((candidate) => candidate.id === fieldId);
    if (!field || !isFilterableCustomField(field)) continue;
    const values = picked(field, taskValues?.get(fieldId));
    if (!values.some((value) => wanted.includes(value))) return false;
  }
  return true;
}

export function normalizeCustomFieldFilters(
  raw: unknown,
): CustomFieldFilterState {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const next: CustomFieldFilterState = {};
  for (const [fieldId, value] of Object.entries(raw)) {
    if (!Array.isArray(value)) continue;
    const values = value.filter(
      (item): item is string => typeof item === "string",
    );
    if (values.length > 0) next[fieldId] = values;
  }
  return next;
}

export function toggleCustomFieldFilter(
  filters: CustomFieldFilterState,
  fieldId: string,
  value: string,
): CustomFieldFilterState {
  const current = filters[fieldId] ?? [];
  const nextValues = current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value];
  const next = { ...filters };
  if (nextValues.length === 0) delete next[fieldId];
  else next[fieldId] = nextValues;
  return next;
}
