import { Check, Columns3 } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import ActiveFilterChip from "@/components/common/active-filter-chip";
import type { CustomFieldDefinition } from "@/components/project/custom-fields/types";
import { formatFieldValue } from "@/components/task/custom-fields/field-value";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import useGetCustomFieldValuesByProject from "@/hooks/queries/custom-field/use-get-custom-field-values-by-project";
import useGetCustomFieldsByProject from "@/hooks/queries/custom-field/use-get-custom-fields-by-project";
import {
  type CustomFieldFilterState,
  customFieldFilterOptions,
  EMPTY_FIELD_VALUE,
  indexCustomFieldValues,
  isFilterableCustomField,
  type TaskFieldValues,
} from "@/lib/backlog-custom-field-filters";
import { cn } from "@/lib/cn";

// Values load in one request per project, and only once a custom field
// column or filter is in use.
export function useBacklogCustomFields(projectId: string, needValues: boolean) {
  const { data: fields = [] } = useGetCustomFieldsByProject(projectId);
  const { data: values, isSuccess } = useGetCustomFieldValuesByProject(
    projectId,
    needValues && fields.length > 0,
  );
  const valuesByTask = useMemo<TaskFieldValues>(
    () => indexCustomFieldValues(values ?? []),
    [values],
  );
  return { fields, valuesByTask, valuesLoaded: isSuccess };
}

function useOptionLabel() {
  const { t } = useTranslation();
  return (field: CustomFieldDefinition, value: string) => {
    if (value === EMPTY_FIELD_VALUE) return t("backlog:customFields.noValue");
    if (field.type === "boolean") {
      return value === "true"
        ? t("backlog:customFields.checked")
        : t("backlog:customFields.unchecked");
    }
    return value;
  };
}

type FilterProps = {
  fields: CustomFieldDefinition[];
  filters: CustomFieldFilterState;
  onToggle: (fieldId: string, value: string) => void;
  onClear: (fieldId: string) => void;
};

export function CustomFieldFilterSubmenus({
  fields,
  filters,
  onToggle,
  onClear,
}: FilterProps) {
  const { t } = useTranslation();
  const optionLabel = useOptionLabel();
  const filterable = fields.filter(isFilterableCustomField);
  if (filterable.length === 0) return null;

  return (
    <>
      <DropdownMenuSeparator />
      {filterable.map((field) => {
        const selected = filters[field.id] ?? [];
        return (
          <DropdownMenuSub key={field.id}>
            <DropdownMenuSubTrigger className="h-8 rounded-md text-sm">
              <span className="truncate">{field.name}</span>
              {selected.length > 0 ? (
                <span className="ml-auto me-1 text-[10px] text-muted-foreground">
                  {selected.length}
                </span>
              ) : null}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-64">
              <div className="grid max-h-64 grid-cols-1 gap-1 overflow-y-auto p-1">
                <FilterOption
                  checked={selected.length === 0}
                  label={t("backlog:filter.allValues")}
                  onClick={() => onClear(field.id)}
                />
                {customFieldFilterOptions(field).map((value) => (
                  <FilterOption
                    key={value}
                    checked={selected.includes(value)}
                    label={optionLabel(field, value)}
                    onClick={() => onToggle(field.id, value)}
                  />
                ))}
              </div>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        );
      })}
    </>
  );
}

function FilterOption({
  checked,
  label,
  onClick,
}: {
  checked: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-left text-xs",
        checked
          ? "bg-accent text-accent-foreground"
          : "text-foreground/90 hover:bg-accent/60 hover:text-foreground",
      )}
      onClick={onClick}
    >
      <span className="flex size-4 shrink-0 items-center justify-center">
        {checked ? <Check className="size-3.5" /> : null}
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}

export function CustomFieldFilterChips({
  fields,
  filters,
  onClear,
}: Omit<FilterProps, "onToggle">) {
  const { t } = useTranslation();
  const optionLabel = useOptionLabel();
  return fields.map((field) => {
    const selected = filters[field.id] ?? [];
    if (selected.length === 0 || !isFilterableCustomField(field)) return null;
    return (
      <ActiveFilterChip
        key={field.id}
        subject={field.name}
        operator={t("tasks:boardFilters.operators.isAnyOf")}
        value={
          selected.length === 1
            ? optionLabel(field, selected[0] ?? "")
            : t("tasks:boardFilters.selectedCount", { count: selected.length })
        }
        onClear={() => onClear(field.id)}
      />
    );
  });
}

export function CustomFieldColumnsMenu({
  fields,
  visible,
  onChange,
}: {
  fields: CustomFieldDefinition[];
  visible: string[];
  onChange: (next: string[]) => void;
}) {
  const { t } = useTranslation();
  if (fields.length === 0) return null;
  const shown = fields.filter((field) => visible.includes(field.id)).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium outline-none ring-0",
              shown > 0
                ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
                : "border-border bg-background text-foreground hover:bg-accent/60",
            )}
          />
        }
      >
        <Columns3 className="h-3 w-3" />
        {t("backlog:customFields.columns")}
        {shown > 0 ? (
          <span className="text-[10px] text-muted-foreground">{shown}</span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[11px] uppercase tracking-wide">
            {t("backlog:customFields.showColumns")}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {fields.map((field) => (
          <DropdownMenuCheckboxItem
            key={field.id}
            checked={visible.includes(field.id)}
            onCheckedChange={(checked) =>
              onChange(
                checked
                  ? [...visible, field.id]
                  : visible.filter((id) => id !== field.id),
              )
            }
          >
            <span className="truncate">{field.name}</span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function CustomFieldCell({
  field,
  value,
}: {
  field: CustomFieldDefinition;
  value: string | null | undefined;
}) {
  if (field.type === "boolean") {
    return value === "true" ? (
      <Check className="h-3.5 w-3.5 text-foreground" />
    ) : (
      <span className="text-muted-foreground">—</span>
    );
  }
  const text = formatFieldValue(field.type, value);
  return text ? (
    <span className="block truncate text-xs text-foreground" title={text}>
      {text}
    </span>
  ) : (
    <span className="text-muted-foreground">—</span>
  );
}
