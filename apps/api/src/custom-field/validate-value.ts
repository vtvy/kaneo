export function isCustomFieldValueEmpty(value: string, type: string): boolean {
  if (value.trim() === "") return true;

  if (type === "multiselect") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) && parsed.length === 0;
    } catch {
      return false;
    }
  }

  return false;
}

function readOptionList(options: unknown): string[] | null {
  if (Array.isArray(options)) return options;
  if (typeof options === "string") {
    try {
      const parsed: unknown = JSON.parse(options);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return [];
}

export function validateCustomFieldValue(
  value: string,
  type: string,
  fieldName: string,
  options?: unknown,
): string | null {
  if (type === "number") {
    const num = Number(value);
    if (!Number.isFinite(num)) {
      return `Custom field "${fieldName}" expects a finite number, got "${value}".`;
    }
  }

  if (type === "boolean") {
    if (!["true", "false"].includes(value)) {
      return `Custom field "${fieldName}" expects "true" or "false", got "${value}".`;
    }
  }

  if (type === "date") {
    const isoMatch =
      /^(\d{4})-(\d{2})-(\d{2})(T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})?)?$/.exec(
        value,
      );

    if (!isoMatch) {
      return `Custom field "${fieldName}" expects a date in YYYY-MM-DD or ISO 8601 format, got "${value}".`;
    }

    if (Number.isNaN(Date.parse(value))) {
      return `Custom field "${fieldName}" expects a valid ISO 8601 date, got "${value}".`;
    }

    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);

    const calendarDate = new Date(0);
    calendarDate.setUTCFullYear(year, month - 1, day);
    calendarDate.setUTCHours(0, 0, 0, 0);

    if (
      calendarDate.getUTCFullYear() !== year ||
      calendarDate.getUTCMonth() !== month - 1 ||
      calendarDate.getUTCDate() !== day
    ) {
      return `Custom field "${fieldName}" expects a valid ISO 8601 date, got "${value}".`;
    }
  }

  if (type === "dropdown") {
    const parsedOptions = readOptionList(options);
    if (!parsedOptions) {
      return `Custom field "${fieldName}" has invalid dropdown options.`;
    }
    if (!parsedOptions.includes(value.trim())) {
      return `Custom field "${fieldName}" expects one of: ${parsedOptions.join(", ")}, got "${value}".`;
    }
  }

  if (type === "multiselect") {
    const parsedOptions = readOptionList(options);
    if (!parsedOptions) {
      return `Custom field "${fieldName}" has invalid multiselect options.`;
    }

    let selectedValues: unknown;
    try {
      selectedValues = JSON.parse(value);
    } catch {
      return `Custom field "${fieldName}" expects a JSON array of selected options, got "${value}".`;
    }

    if (!Array.isArray(selectedValues) || selectedValues.length === 0) {
      return `Custom field "${fieldName}" expects at least one selected option.`;
    }

    const invalidValues = selectedValues.filter(
      (v) => typeof v !== "string" || !parsedOptions.includes(v),
    );

    if (invalidValues.length > 0) {
      return `Custom field "${fieldName}" expects values from: ${parsedOptions.join(", ")}, got invalid value(s): ${invalidValues.join(", ")}.`;
    }
  }

  return null;
}
