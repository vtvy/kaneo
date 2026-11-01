import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import useCreateCustomField from "@/hooks/mutations/custom-field/use-create-custom-field";
import useUpdateCustomField from "@/hooks/mutations/custom-field/use-update-custom-field";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import {
  addOption,
  type FieldFormState,
  formFromField,
  getFormIssue,
  moveOption,
  removeOption,
  renameOption,
  setKind,
  setMultiple,
  toCreatePayload,
  toggleOptionHidden,
  toUpdatePayload,
  visibleOptions,
} from "./field-form";
import { FIELD_KINDS } from "./field-kinds";
import type { CustomFieldDefinition, FieldKind } from "./types";

const NO_DEFAULT = "__none__";

type CustomFieldDialogProps = {
  projectId: string;
  field: CustomFieldDefinition | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function CustomFieldDialog({
  projectId,
  field,
  open,
  onOpenChange,
}: CustomFieldDialogProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<FieldFormState>(() => formFromField(field));
  const [newOption, setNewOption] = useState("");
  const { mutateAsync: createField, isPending: isCreating } =
    useCreateCustomField(projectId);
  const { mutateAsync: updateField, isPending: isUpdating } =
    useUpdateCustomField(projectId);
  const isEditing = Boolean(field);
  const isPending = isCreating || isUpdating;
  const issue = getFormIssue(form);

  useEffect(() => {
    if (open) {
      setForm(formFromField(field));
      setNewOption("");
    }
  }, [open, field]);

  const handleAddOption = () => {
    setForm((state) => addOption(state, newOption));
    setNewOption("");
  };

  const handleSave = async () => {
    if (issue) return;
    try {
      if (field) {
        await updateField({ id: field.id, data: toUpdatePayload(form) });
        toast.success(t("settings:projectCustomFields.toast.updated"));
      } else {
        await createField(toCreatePayload(form, projectId));
        toast.success(t("settings:projectCustomFields.toast.created"));
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:projectCustomFields.toast.saveError"),
      );
    }
  };

  const defaultOptions = visibleOptions(form);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? t("settings:projectCustomFields.dialog.editTitle")
              : t("settings:projectCustomFields.dialog.createTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("settings:projectCustomFields.dialog.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-6 pb-2 max-h-[60vh] overflow-y-auto">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="custom-field-name">
              {t("settings:projectCustomFields.dialog.nameLabel")}
            </Label>
            <Input
              id="custom-field-name"
              value={form.name}
              maxLength={200}
              placeholder={t(
                "settings:projectCustomFields.dialog.namePlaceholder",
              )}
              onChange={(event) =>
                setForm((state) => ({ ...state, name: event.target.value }))
              }
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{t("settings:projectCustomFields.dialog.typeLabel")}</Label>
            <Select
              value={form.kind}
              disabled={isEditing}
              onValueChange={(value) =>
                value && setForm((state) => setKind(state, value as FieldKind))
              }
            >
              <SelectTrigger>
                <SelectValue>
                  {t(`settings:projectCustomFields.types.${form.kind}`)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {FIELD_KINDS.map(({ kind, icon: Icon }) => (
                  <SelectItem key={kind} value={kind}>
                    <span className="flex items-center gap-2">
                      <Icon className="size-3.5" />
                      {t(`settings:projectCustomFields.types.${kind}`)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isEditing && (
              <p className="text-xs text-muted-foreground">
                {t("settings:projectCustomFields.dialog.typeLocked")}
              </p>
            )}
          </div>

          {form.kind === "dropdown" && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label>
                  {t("settings:projectCustomFields.dialog.optionsLabel")}
                </Label>
                <Label className="text-xs font-normal">
                  <Switch
                    checked={form.multiple}
                    onCheckedChange={(checked) =>
                      setForm((state) => setMultiple(state, checked))
                    }
                  />
                  {t("settings:projectCustomFields.dialog.allowMultiple")}
                </Label>
              </div>
              <ul className="flex flex-col gap-1">
                {form.options.map((option, index) => {
                  const hidden = form.hiddenOptions.includes(option);
                  return (
                    <li key={option} className="flex items-center gap-1">
                      <Input
                        defaultValue={option}
                        className={cn("h-8", hidden && "text-muted-foreground")}
                        aria-label={t(
                          "settings:projectCustomFields.dialog.renameOption",
                        )}
                        onBlur={(event) => {
                          const next = renameOption(
                            form,
                            option,
                            event.target.value,
                          );
                          if (next === form) event.target.value = option;
                          else setForm(next);
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={index === 0}
                        aria-label={t(
                          "settings:projectCustomFields.dialog.moveUp",
                        )}
                        onClick={() =>
                          setForm((state) =>
                            moveOption(state, index, index - 1),
                          )
                        }
                      >
                        <ArrowUp className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={index === form.options.length - 1}
                        aria-label={t(
                          "settings:projectCustomFields.dialog.moveDown",
                        )}
                        onClick={() =>
                          setForm((state) =>
                            moveOption(state, index, index + 1),
                          )
                        }
                      >
                        <ArrowDown className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title={
                          hidden
                            ? t(
                                "settings:projectCustomFields.dialog.showOption",
                              )
                            : t(
                                "settings:projectCustomFields.dialog.hideOption",
                              )
                        }
                        aria-label={
                          hidden
                            ? t(
                                "settings:projectCustomFields.dialog.showOption",
                              )
                            : t(
                                "settings:projectCustomFields.dialog.hideOption",
                              )
                        }
                        onClick={() =>
                          setForm((state) => toggleOptionHidden(state, option))
                        }
                      >
                        {hidden ? (
                          <EyeOff className="size-3.5" />
                        ) : (
                          <Eye className="size-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t(
                          "settings:projectCustomFields.dialog.removeOption",
                        )}
                        onClick={() =>
                          setForm((state) => removeOption(state, option))
                        }
                      >
                        <X className="size-3.5" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
              <div className="flex items-center gap-1">
                <Input
                  value={newOption}
                  className="h-8"
                  placeholder={t(
                    "settings:projectCustomFields.dialog.addOptionPlaceholder",
                  )}
                  onChange={(event) => setNewOption(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleAddOption();
                    }
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!newOption.trim()}
                  onClick={handleAddOption}
                >
                  <Plus className="size-3.5" />
                  {t("settings:projectCustomFields.dialog.addOption")}
                </Button>
              </div>
              {form.hiddenOptions.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t("settings:projectCustomFields.dialog.hiddenHint")}
                </p>
              )}
            </div>
          )}

          <Label className="flex items-center justify-between gap-2 font-normal">
            <span className="flex flex-col">
              {t("settings:projectCustomFields.dialog.requiredLabel")}
              <span className="text-xs text-muted-foreground">
                {t("settings:projectCustomFields.dialog.requiredHint")}
              </span>
            </span>
            <Switch
              checked={form.required}
              onCheckedChange={(checked) =>
                setForm((state) => ({ ...state, required: checked }))
              }
            />
          </Label>

          <div className="flex flex-col gap-1.5">
            <Label>
              {t("settings:projectCustomFields.dialog.defaultLabel")}
            </Label>
            {(form.kind === "text" ||
              form.kind === "number" ||
              form.kind === "date") && (
              <Input
                type={
                  form.kind === "number"
                    ? "number"
                    : form.kind === "date"
                      ? "date"
                      : "text"
                }
                value={form.defaultValue}
                onChange={(event) =>
                  setForm((state) => ({
                    ...state,
                    defaultValue: event.target.value,
                  }))
                }
              />
            )}
            {form.kind === "boolean" && (
              <Label className="font-normal">
                <Checkbox
                  checked={form.defaultValue === "true"}
                  onCheckedChange={(checked) =>
                    setForm((state) => ({
                      ...state,
                      defaultValue: checked ? "true" : "false",
                    }))
                  }
                />
                {t("settings:projectCustomFields.dialog.defaultChecked")}
              </Label>
            )}
            {form.kind === "dropdown" && !form.multiple && (
              <Select
                value={form.defaultValue || NO_DEFAULT}
                onValueChange={(value) =>
                  setForm((state) => ({
                    ...state,
                    defaultValue:
                      !value || value === NO_DEFAULT ? "" : String(value),
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue>
                    {form.defaultValue ||
                      t("settings:projectCustomFields.dialog.noDefault")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_DEFAULT}>
                    {t("settings:projectCustomFields.dialog.noDefault")}
                  </SelectItem>
                  {defaultOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {form.kind === "dropdown" && form.multiple && (
              <div className="flex flex-wrap gap-3">
                {defaultOptions.map((option) => (
                  <Label
                    key={option}
                    className="flex items-center gap-1.5 text-sm"
                  >
                    <Checkbox
                      checked={form.defaultValues.includes(option)}
                      onCheckedChange={(checked) =>
                        setForm((state) => ({
                          ...state,
                          defaultValues: checked
                            ? state.options.filter(
                                (candidate) =>
                                  candidate === option ||
                                  state.defaultValues.includes(candidate),
                              )
                            : state.defaultValues.filter(
                                (value) => value !== option,
                              ),
                        }))
                      }
                    />
                    {option}
                  </Label>
                ))}
              </div>
            )}
          </div>

          {issue && (
            <p className="text-xs text-muted-foreground">
              {t(`settings:projectCustomFields.issues.${issue}`)}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            {t("settings:projectCustomFields.dialog.cancel")}
          </Button>
          <Button
            size="sm"
            disabled={isPending || Boolean(issue)}
            onClick={handleSave}
          >
            {isEditing
              ? t("settings:projectCustomFields.dialog.save")
              : t("settings:projectCustomFields.dialog.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
