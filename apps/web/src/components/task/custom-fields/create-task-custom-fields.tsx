import { useTranslation } from "react-i18next";
import type { CustomFieldDefinition } from "@/components/project/custom-fields/types";
import {
  type CreateTaskFieldValues,
  displayedFieldValue,
} from "./create-task-field-values";
import { FieldEditor } from "./task-custom-fields";

export default function CreateTaskCustomFields({
  fields,
  values,
  onChange,
}: {
  fields: CustomFieldDefinition[];
  values: CreateTaskFieldValues;
  onChange: (fieldId: string, value: string) => void;
}) {
  const { t } = useTranslation();
  if (fields.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-foreground/70">
        {t("tasks:customFields.title")}
      </span>
      <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
        {fields.map((field) => (
          <div
            key={field.id}
            className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-center gap-2"
          >
            <span
              className="text-xs text-muted-foreground truncate"
              title={field.name}
            >
              {field.name}
              {field.required && <span aria-hidden="true"> *</span>}
            </span>
            <FieldEditor
              field={field}
              value={displayedFieldValue(field, values)}
              canEdit
              live
              onSave={(value) => onChange(field.id, value)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
