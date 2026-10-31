import type { CustomFieldDefinition } from "@/components/project/custom-fields/types";
import { parseMultiselect } from "./parse-multiselect";

// Hidden options can't be picked anew, but a task that already uses one keeps
// it, so the editor still lists it for that task.
export function selectableOptions(
  field: Pick<CustomFieldDefinition, "options" | "hiddenOptions" | "type">,
  current: string | null | undefined,
): string[] {
  const options = field.options ?? [];
  const hidden = new Set(field.hiddenOptions ?? []);
  const picked = new Set(
    field.type === "multiselect"
      ? parseMultiselect(current)
      : current
        ? [current]
        : [],
  );
  return options.filter((option) => !hidden.has(option) || picked.has(option));
}

export function toggleMultiselectValue(
  current: string | null | undefined,
  option: string,
  options: string[],
): string {
  const picked = new Set(parseMultiselect(current));
  if (picked.has(option)) picked.delete(option);
  else picked.add(option);
  // Keep the field's option order so values compare and display consistently.
  const next = options.filter((candidate) => picked.has(candidate));
  return next.length > 0 ? JSON.stringify(next) : "";
}

export function formatFieldValue(
  type: CustomFieldDefinition["type"],
  raw: string | null | undefined,
): string {
  if (!raw) return "";
  if (type === "multiselect") return parseMultiselect(raw).join(", ");
  return raw.trim();
}
