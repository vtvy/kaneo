import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CustomFieldDefinition } from "@/components/project/custom-fields/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import useSetCustomFieldValue from "@/hooks/mutations/custom-field/use-set-custom-field-value";
import useGetCustomFieldValuesByTask from "@/hooks/queries/custom-field/use-get-custom-field-values-by-task";
import useGetCustomFieldsByProject from "@/hooks/queries/custom-field/use-get-custom-fields-by-project";
import { useProjectPermission } from "@/hooks/use-project-permission";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";
import {
  formatFieldValue,
  selectableOptions,
  toggleMultiselectValue,
} from "./field-value";
import { parseMultiselect } from "./parse-multiselect";

const EMPTY_OPTION = "__empty__";

type FieldEditorProps = {
  field: CustomFieldDefinition;
  value: string;
  canEdit: boolean;
  onSave: (value: string) => void;
};

function TextLikeEditor({ field, value, canEdit, onSave }: FieldEditorProps) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const commit = () => {
    if (draft.trim() !== value.trim()) onSave(draft);
  };

  return (
    <Input
      type={
        field.type === "number"
          ? "number"
          : field.type === "date"
            ? "date"
            : "text"
      }
      value={draft}
      disabled={!canEdit}
      className="h-7 text-xs"
      onChange={(event) => {
        setDraft(event.target.value);
        if (field.type === "date") onSave(event.target.value);
      }}
      onBlur={field.type === "date" ? undefined : commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
        }
      }}
    />
  );
}

function DropdownEditor({ field, value, canEdit, onSave }: FieldEditorProps) {
  const { t } = useTranslation();
  const options = selectableOptions(field, value);

  return (
    <Select
      value={value || EMPTY_OPTION}
      disabled={!canEdit}
      onValueChange={(next) =>
        onSave(!next || next === EMPTY_OPTION ? "" : String(next))
      }
    >
      <SelectTrigger className="h-7 text-xs">
        <SelectValue>{value || t("tasks:customFields.empty")}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {!field.required && (
          <SelectItem value={EMPTY_OPTION}>
            {t("tasks:customFields.empty")}
          </SelectItem>
        )}
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function MultiselectEditor({
  field,
  value,
  canEdit,
  onSave,
}: FieldEditorProps) {
  const { t } = useTranslation();
  const picked = parseMultiselect(value);
  const options = selectableOptions(field, value);
  const label = formatFieldValue("multiselect", value);

  if (!canEdit) {
    return (
      <span className="text-xs truncate px-1.5">
        {label || t("tasks:customFields.empty")}
      </span>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-full justify-between gap-1 text-xs font-normal"
        >
          <span className={cn("truncate", !label && "text-muted-foreground")}>
            {label || t("tasks:customFields.empty")}
          </span>
          <ChevronDown className="size-3.5 shrink-0 opacity-70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-2">
        <div className="flex flex-col gap-1">
          {options.map((option) => (
            <Label
              key={option}
              className="flex items-center gap-2 rounded px-1.5 py-1 text-xs font-normal hover:bg-accent"
            >
              <Checkbox
                checked={picked.includes(option)}
                onCheckedChange={() =>
                  onSave(
                    toggleMultiselectValue(value, option, field.options ?? []),
                  )
                }
              />
              {option}
            </Label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function FieldEditor(props: FieldEditorProps) {
  const { field, value, canEdit, onSave } = props;

  if (field.type === "boolean") {
    return (
      <Checkbox
        checked={value === "true"}
        disabled={!canEdit}
        onCheckedChange={(checked) => onSave(checked ? "true" : "false")}
      />
    );
  }
  if (field.type === "dropdown") return <DropdownEditor {...props} />;
  if (field.type === "multiselect") return <MultiselectEditor {...props} />;
  return <TextLikeEditor {...props} />;
}

export default function TaskCustomFields({
  task,
  className,
}: {
  task: Task;
  className?: string;
}) {
  const { t } = useTranslation();
  const { data: fields = [] } = useGetCustomFieldsByProject(task.projectId);
  const { data: values = [] } = useGetCustomFieldValuesByTask(task.id);
  const { mutateAsync: setValue } = useSetCustomFieldValue();
  const { canManageTasks } = useWorkspacePermission();
  const { can: canProject, isCheckingPermissions } = useProjectPermission(
    task.projectId,
  );
  const canEdit =
    canManageTasks() ||
    (!isCheckingPermissions && canProject("item", "update"));

  if (fields.length === 0) return null;

  const valueByField = new Map(
    values.map((entry) => [entry.fieldId, entry.value ?? ""]),
  );

  const save = async (fieldId: string, value: string) => {
    try {
      await setValue({ taskId: task.id, fieldId, value });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:customFields.updateError"),
      );
    }
  };

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-xs font-medium text-foreground/70 px-2">
        {t("tasks:customFields.title")}
      </span>
      <div className="flex flex-col gap-1.5 px-2">
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
              value={valueByField.get(field.id) ?? ""}
              canEdit={canEdit}
              onSave={(value) => save(field.id, value)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
