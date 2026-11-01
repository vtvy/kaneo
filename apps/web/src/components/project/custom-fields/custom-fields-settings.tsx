import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import useDeleteCustomField from "@/hooks/mutations/custom-field/use-delete-custom-field";
import useReorderCustomFields from "@/hooks/mutations/custom-field/use-reorder-custom-fields";
import useGetCustomFieldsByProject from "@/hooks/queries/custom-field/use-get-custom-fields-by-project";
import { useProjectPermission } from "@/hooks/use-project-permission";
import { toast } from "@/lib/toast";
import CustomFieldDialog from "./custom-field-dialog";
import { FIELD_KIND_ICONS, toFieldKind } from "./field-kinds";
import type { CustomFieldDefinition } from "./types";

export default function CustomFieldsSettings({
  projectId,
}: {
  projectId: string;
}) {
  const { t } = useTranslation();
  const { data: fields = [], isLoading } =
    useGetCustomFieldsByProject(projectId);
  const { can } = useProjectPermission(projectId);
  const canManage = can("role", "manage");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CustomFieldDefinition | null>(null);
  const [toDelete, setToDelete] = useState<CustomFieldDefinition | null>(null);
  const { mutateAsync: deleteField, isPending: isDeleting } =
    useDeleteCustomField(projectId);
  const { mutateAsync: reorderFields, isPending: isReordering } =
    useReorderCustomFields(projectId);

  const openDialog = (field: CustomFieldDefinition | null) => {
    setEditing(field);
    setDialogOpen(true);
  };

  const move = async (from: number, to: number) => {
    const next = [...fields];
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    try {
      await reorderFields(
        next.map((field, position) => ({ id: field.id, position })),
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:projectCustomFields.toast.reorderError"),
      );
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteField({ id: toDelete.id });
      toast.success(t("settings:projectCustomFields.toast.deleted"));
      setToDelete(null);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:projectCustomFields.toast.deleteError"),
      );
    }
  };

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => openDialog(null)}>
            <Plus className="size-4" />
            {t("settings:projectCustomFields.addField")}
          </Button>
        </div>
      )}

      {!isLoading && fields.length === 0 && (
        <p className="text-sm text-muted-foreground rounded-md border border-dashed border-border p-6 text-center">
          {t("settings:projectCustomFields.empty")}
        </p>
      )}

      <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
        {fields.map((field, index) => {
          const Icon = FIELD_KIND_ICONS[toFieldKind(field.type)];
          const hidden = field.hiddenOptions ?? [];
          return (
            <li key={field.id} className="flex items-center gap-3 px-3 py-2">
              <Icon className="size-4 text-muted-foreground shrink-0" />
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-sm font-medium truncate">
                  {field.name}
                </span>
                <span className="text-xs text-muted-foreground truncate">
                  {t(`settings:projectCustomFields.types.${field.type}`)}
                  {field.options && field.options.length > 0
                    ? ` · ${field.options
                        .filter((option) => !hidden.includes(option))
                        .join(", ")}`
                    : ""}
                  {hidden.length > 0
                    ? ` · ${t("settings:projectCustomFields.hiddenCount", {
                        count: hidden.length,
                      })}`
                    : ""}
                </span>
              </div>
              {field.required && (
                <Badge variant="outline">
                  {t("settings:projectCustomFields.required")}
                </Badge>
              )}
              {canManage && (
                <div className="flex items-center">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={index === 0 || isReordering}
                    aria-label={t("settings:projectCustomFields.dialog.moveUp")}
                    onClick={() => move(index, index - 1)}
                  >
                    <ArrowUp className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={index === fields.length - 1 || isReordering}
                    aria-label={t(
                      "settings:projectCustomFields.dialog.moveDown",
                    )}
                    onClick={() => move(index, index + 1)}
                  >
                    <ArrowDown className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("settings:projectCustomFields.edit")}
                    onClick={() => openDialog(field)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("settings:projectCustomFields.delete")}
                    onClick={() => setToDelete(field)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {canManage && (
        <CustomFieldDialog
          projectId={projectId}
          field={editing}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      )}

      <AlertDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("settings:projectCustomFields.deleteDialog.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings:projectCustomFields.deleteDialog.description", {
                name: toDelete?.name ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose disabled={isDeleting}>
              <Button variant="outline" size="sm" disabled={isDeleting}>
                {t("settings:projectCustomFields.dialog.cancel")}
              </Button>
            </AlertDialogClose>
            <Button
              variant="destructive"
              size="sm"
              disabled={isDeleting}
              onClick={confirmDelete}
            >
              <Trash2 className="size-4" />
              {t("settings:projectCustomFields.deleteDialog.confirm")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
