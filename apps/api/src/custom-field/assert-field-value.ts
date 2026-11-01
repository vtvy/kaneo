import { HTTPException } from "hono/http-exception";
import {
  findNewHiddenPicks,
  isChoiceType,
  readHiddenOptions,
  readOptions,
} from "./choice-options";
import { isCustomFieldValueEmpty } from "./validate-value";

type FieldForValue = {
  type: string;
  required: boolean;
  options: unknown;
  hiddenOptions: unknown;
};

function badRequest(message: string): never {
  throw new HTTPException(400, { message });
}

// Checks a value against its field and returns it trimmed. `current` is the
// task's stored value (null for a new task): hidden options it already holds
// stay allowed, new picks of hidden options are rejected.
export function assertCustomFieldValue(
  field: FieldForValue,
  value: string,
  current: string | null,
): string {
  const normalized = value.trim();

  if (isCustomFieldValueEmpty(normalized, field.type)) {
    if (field.required) badRequest("This custom field is required");
    return normalized;
  }

  if (field.type === "dropdown") {
    if (Array.isArray(field.options) && !field.options.includes(normalized)) {
      badRequest("Invalid option for this custom field");
    }
  }

  if (field.type === "number" && Number.isNaN(Number(normalized))) {
    badRequest("Value must be a valid number");
  }

  if (
    field.type === "boolean" &&
    normalized !== "true" &&
    normalized !== "false"
  ) {
    badRequest("Value must be true or false");
  }

  if (field.type === "multiselect") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(normalized);
    } catch {
      badRequest("Value must be a valid JSON array");
    }
    if (!Array.isArray(parsed)) badRequest("Value must be a JSON array");
    if (Array.isArray(field.options)) {
      const options = field.options as unknown[];
      if (parsed.some((v) => typeof v !== "string" || !options.includes(v))) {
        badRequest("Invalid option(s) for this custom field");
      }
    }
  }

  if (isChoiceType(field.type)) {
    const hidden = readHiddenOptions(
      field.hiddenOptions,
      readOptions(field.options),
    );
    if (findNewHiddenPicks(normalized, current, field.type, hidden).length) {
      badRequest("Hidden options can't be selected");
    }
  }

  return normalized;
}
