import { createFileRoute, useParams } from "@tanstack/react-router";
import { Plus, Shield, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import {
  Accordion,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import useCreateProjectRole from "@/hooks/mutations/project-rbac/use-create-project-role";
import useDeleteProjectRole from "@/hooks/mutations/project-rbac/use-delete-project-role";
import useUpdateProjectRole from "@/hooks/mutations/project-rbac/use-update-project-role";
import useProjectRoles from "@/hooks/queries/project-rbac/use-project-roles";
import { useProjectPermission } from "@/hooks/use-project-permission";
import { toast } from "@/lib/toast";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/projects/$projectId/roles",
)({
  component: RouteComponent,
});

// ---------- catalog (mirrors PROJECT_PERMISSION_CATALOG on the backend) ------

const PROJECT_CATALOG: Record<string, string[]> = {
  item: ["create", "read", "update", "delete", "transition", "assign"],
  sprint: ["create", "start", "complete", "manage"],
  backlog: ["read", "manage"],
  doc: ["view", "upload", "manage", "empty_trash"],
  role: ["manage"],
  member: ["manage"],
};

// ---------- helpers -----------------------------------------------------------

type ProjectRole = {
  id: string;
  name: string;
  isSystem: boolean;
  permissions: Record<string, string[]>;
};

function permissionsEqual(
  a: Record<string, string[]>,
  b: Record<string, string[]>,
): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    const arrA = [...(a[key] ?? [])].sort();
    const arrB = [...(b[key] ?? [])].sort();
    if (arrA.length !== arrB.length) return false;
    for (let i = 0; i < arrA.length; i += 1) {
      if (arrA[i] !== arrB[i]) return false;
    }
  }
  return true;
}

function permissionCount(permissions: Record<string, string[] | undefined>) {
  return Object.values(permissions).reduce(
    (sum, actions) => sum + (actions?.length ?? 0),
    0,
  );
}

// ---------- PermissionList ---------------------------------------------------

function PermissionList({
  selected,
  onToggle,
  readOnly,
  disabled,
}: {
  selected: Record<string, Set<string>>;
  onToggle?: (resource: string, action: string) => void;
  readOnly?: boolean;
  disabled?: boolean;
}) {
  const { t } = useTranslation("settings");
  const groups = Object.entries(PROJECT_CATALOG);

  return (
    <div className="border-t border-border">
      {groups.map(([resource, actions], groupIndex) => (
        <div key={resource}>
          {groupIndex > 0 && <Separator />}
          <div className="space-y-4 p-4">
            <p className="text-sm font-medium">
              {t(`projectRoles.resources.${resource}`)}
            </p>
            <div className="space-y-4">
              {actions.map((action, idx) => {
                const key = `${resource}:${action}`;
                const label = t(
                  `projectRoles.permissions.${resource}.${action}.label`,
                );
                const description = t(
                  `projectRoles.permissions.${resource}.${action}.description`,
                );
                return (
                  <div key={key}>
                    {idx > 0 && <Separator className="mb-4" />}
                    <div className="flex items-center justify-between gap-6">
                      <div className="space-y-0.5 flex-1 min-w-0">
                        <Label className="text-sm font-medium">{label}</Label>
                        {description && (
                          <p className="text-xs text-muted-foreground">
                            {description}
                          </p>
                        )}
                      </div>
                      <Switch
                        checked={selected[resource]?.has(action) ?? false}
                        onCheckedChange={
                          readOnly || !onToggle
                            ? undefined
                            : () => onToggle(resource, action)
                        }
                        disabled={readOnly || disabled}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- DraftEditor (new role) -------------------------------------------

function DraftEditor({
  projectId,
  existingNames,
  onCreated,
  onDiscard,
}: {
  projectId: string;
  existingNames: string[];
  onCreated: (roleId: string) => void;
  onDiscard: () => void;
}) {
  const { t } = useTranslation("settings");
  const [name, setName] = useState("");
  const [permissions, setPermissions] = useState<Record<string, Set<string>>>(
    {},
  );
  const { mutateAsync: createRole, isPending } =
    useCreateProjectRole(projectId);

  const togglePermission = (resource: string, action: string) => {
    setPermissions((prev) => {
      const next = { ...prev };
      const set = new Set(next[resource] ?? []);
      if (set.has(action)) set.delete(action);
      else set.add(action);
      next[resource] = set;
      return next;
    });
  };

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error(t("projectRoles.toast.nameRequired"));
      return;
    }
    if (
      existingNames.map((n) => n.toLowerCase()).includes(trimmed.toLowerCase())
    ) {
      toast.error(t("projectRoles.toast.nameExists"));
      return;
    }
    const perms: Record<string, string[]> = {};
    for (const [r, set] of Object.entries(permissions)) {
      if (set.size > 0) perms[r] = Array.from(set);
    }
    if (Object.keys(perms).length === 0) {
      toast.error(t("projectRoles.toast.permissionRequired"));
      return;
    }
    try {
      const created = await createRole({ name: trimmed, permissions: perms });
      toast.success(t("projectRoles.toast.created"));
      onCreated((created as ProjectRole).id);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("projectRoles.toast.createError"),
      );
    }
  };

  return (
    <div>
      <div className="border-t border-border">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">
              {t("projectRoles.nameLabel")}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t("projectRoles.nameHint")}
            </p>
          </div>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("projectRoles.namePlaceholder")}
            className="w-64"
            autoFocus
            disabled={isPending}
          />
        </div>
      </div>
      <div className="max-h-[60vh] overflow-y-auto">
        <PermissionList
          selected={permissions}
          onToggle={togglePermission}
          disabled={isPending}
        />
      </div>
      <Separator />
      <div className="flex justify-end gap-2 px-4 py-3 bg-sidebar">
        <Button
          variant="ghost"
          size="sm"
          onClick={onDiscard}
          disabled={isPending}
        >
          <X className="w-4 h-4" />
          {t("projectRoles.discard")}
        </Button>
        <Button size="sm" onClick={handleCreate} disabled={isPending}>
          {t("projectRoles.createRole")}
        </Button>
      </div>
    </div>
  );
}

// ---------- ProjectRoleEditor ------------------------------------------------

function ProjectRoleEditor({
  projectId,
  role,
  onDelete,
}: {
  projectId: string;
  role: ProjectRole;
  onDelete: () => void;
}) {
  const [permissions, setPermissions] = useState<Record<string, Set<string>>>(
    () => {
      const out: Record<string, Set<string>> = {};
      for (const [r, actions] of Object.entries(role.permissions)) {
        out[r] = new Set(actions);
      }
      return out;
    },
  );
  const { t } = useTranslation("settings");
  const { mutateAsync: updateRole, isPending } =
    useUpdateProjectRole(projectId);

  const currentPermissions = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const [r, set] of Object.entries(permissions)) {
      if (set.size > 0) out[r] = Array.from(set);
    }
    return out;
  }, [permissions]);

  const dirty = !permissionsEqual(currentPermissions, role.permissions);

  const togglePermission = (resource: string, action: string) => {
    setPermissions((prev) => {
      const next = { ...prev };
      const set = new Set(next[resource] ?? []);
      if (set.has(action)) set.delete(action);
      else set.add(action);
      next[resource] = set;
      return next;
    });
  };

  const handleSave = async () => {
    if (Object.keys(currentPermissions).length === 0) {
      toast.error(t("projectRoles.toast.permissionRequired"));
      return;
    }
    try {
      await updateRole({ roleId: role.id, permissions: currentPermissions });
      toast.success(t("projectRoles.toast.updated"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("projectRoles.toast.updateError"),
      );
    }
  };

  return (
    <div>
      <div className="max-h-[60vh] overflow-y-auto">
        <PermissionList
          selected={permissions}
          onToggle={role.isSystem ? undefined : togglePermission}
          readOnly={role.isSystem}
          disabled={isPending}
        />
      </div>
      <Separator />
      <div className="flex items-center justify-between gap-2 px-4 py-3 bg-sidebar">
        {role.isSystem ? (
          <span className="text-xs text-muted-foreground">
            {t("projectRoles.systemLocked")}
          </span>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="text-destructive hover:text-destructive"
            disabled={isPending}
          >
            <Trash2 className="w-4 h-4" />
            {t("projectRoles.deleteRoleBtn")}
          </Button>
        )}
        {!role.isSystem && (
          <div className="flex items-center gap-3">
            <p className="text-xs text-muted-foreground">
              {dirty
                ? t("projectRoles.unsavedChanges")
                : t("projectRoles.allSaved")}
            </p>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isPending || !dirty}
            >
              {t("projectRoles.saveChanges")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- DeleteRoleConfirm ------------------------------------------------

function DeleteRoleConfirm({
  role,
  projectId,
  onDeleted,
  onCancel,
}: {
  role: ProjectRole | null;
  projectId: string;
  onDeleted: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation("settings");
  const { mutateAsync: deleteRole, isPending } =
    useDeleteProjectRole(projectId);

  return (
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>
          {t("projectRoles.deleteDialog.title")}
        </AlertDialogTitle>
        <AlertDialogDescription>
          {role
            ? t("projectRoles.deleteDialog.description", { name: role.name })
            : ""}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogClose disabled={isPending}>
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={onCancel}
          >
            {t("projectRoles.deleteDialog.cancel")}
          </Button>
        </AlertDialogClose>
        <Button
          variant="destructive"
          size="sm"
          disabled={isPending || !role}
          onClick={async () => {
            if (!role) return;
            try {
              await deleteRole(role.id);
              toast.success(t("projectRoles.toast.deleted"));
              onDeleted();
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : t("projectRoles.toast.deleteError"),
              );
            }
          }}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          {t("projectRoles.deleteDialog.confirm")}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
}

// ---------- RouteComponent ---------------------------------------------------

function RouteComponent() {
  const { projectId: rawProjectId } = useParams({ strict: false });
  const projectId = rawProjectId ?? "";

  const { t } = useTranslation("settings");
  const { can, isCheckingPermissions } = useProjectPermission(projectId);
  const canManage = !isCheckingPermissions && can("role", "manage");

  const {
    data: rawRoles = [],
    isLoading,
    isError,
    error,
  } = useProjectRoles(projectId);
  const roles = rawRoles as ProjectRole[];

  const [draftActive, setDraftActive] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<ProjectRole | null>(null);
  const [openAccordion, setOpenAccordion] = useState<string[]>([]);

  // Owner first (isSystem), then alphabetical
  const sortedRoles = useMemo(() => {
    return [...roles].sort((a, b) => {
      if (a.isSystem && !b.isSystem) return -1;
      if (!a.isSystem && b.isSystem) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [roles]);

  if (!canManage && !isCheckingPermissions) {
    return (
      <>
        <PageTitle title={t("projectRoles.pageTitle")} />
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">
              {t("projectRoles.title")}
            </h1>
            <p className="text-muted-foreground">
              {t("projectRoles.noPermission")}
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageTitle title={t("projectRoles.pageTitle")} />
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">
              {t("projectRoles.title")}
            </h1>
            <p className="text-muted-foreground">
              {t("projectRoles.subtitle")}
            </p>
          </div>
          {canManage && (
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => {
                setDraftActive(true);
                setOpenAccordion((prev) =>
                  prev.includes("__draft__") ? prev : [...prev, "__draft__"],
                );
              }}
              disabled={draftActive}
            >
              <Plus className="w-3.5 h-3.5" />
              {t("projectRoles.newRole")}
            </Button>
          )}
        </div>

        <div className="border border-border rounded-md bg-sidebar">
          {isLoading && !draftActive ? (
            <p className="text-xs text-muted-foreground px-4 py-6">
              {t("projectRoles.loading")}
            </p>
          ) : isError ? (
            <p className="text-xs text-destructive px-4 py-6">
              {error instanceof Error
                ? error.message
                : t("projectRoles.loadError")}
            </p>
          ) : sortedRoles.length === 0 && !draftActive ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Shield />
                </EmptyMedia>
                <EmptyTitle>{t("projectRoles.noRoles")}</EmptyTitle>
                <EmptyDescription>
                  {t("projectRoles.noRolesHint")}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Accordion
              multiple
              value={openAccordion}
              onValueChange={(value) =>
                setOpenAccordion(Array.isArray(value) ? value : [value])
              }
            >
              {draftActive && (
                <AccordionItem
                  value="__draft__"
                  className="border-b border-border last:border-b-0"
                >
                  <AccordionTrigger className="px-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <Shield className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <p className="text-sm font-medium italic">
                        {t("projectRoles.draftTitle")}
                      </p>
                    </div>
                  </AccordionTrigger>
                  <AccordionPanel className="px-0 pt-0 pb-0">
                    <DraftEditor
                      projectId={projectId}
                      existingNames={roles.map((r) => r.name)}
                      onCreated={(roleId) => {
                        setDraftActive(false);
                        setOpenAccordion((prev) => [
                          ...prev.filter((v) => v !== "__draft__"),
                          roleId,
                        ]);
                      }}
                      onDiscard={() => {
                        setDraftActive(false);
                        setOpenAccordion((prev) =>
                          prev.filter((v) => v !== "__draft__"),
                        );
                      }}
                    />
                  </AccordionPanel>
                </AccordionItem>
              )}

              {sortedRoles.map((role) => (
                <AccordionItem
                  key={role.id}
                  value={role.id}
                  className="border-b border-border last:border-b-0"
                >
                  <AccordionTrigger className="px-4">
                    <div className="flex items-center justify-between gap-4 flex-1 min-w-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <Shield className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">
                              {role.name}
                            </p>
                            {role.isSystem && (
                              <span className="text-[10px] uppercase tracking-wide font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                {t("projectRoles.systemBadge")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <p className="text-xs font-normal text-muted-foreground shrink-0">
                        {t("projectRoles.permissionsCount", {
                          count: permissionCount(role.permissions),
                        })}
                      </p>
                    </div>
                  </AccordionTrigger>
                  <AccordionPanel className="px-0 pt-0 pb-0">
                    <ProjectRoleEditor
                      key={role.id}
                      projectId={projectId}
                      role={role}
                      onDelete={() => setRoleToDelete(role)}
                    />
                  </AccordionPanel>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>
      </div>

      <AlertDialog
        open={!!roleToDelete}
        onOpenChange={(open) => !open && setRoleToDelete(null)}
      >
        <DeleteRoleConfirm
          role={roleToDelete}
          projectId={projectId}
          onDeleted={() => {
            setOpenAccordion((prev) =>
              prev.filter((v) => v !== roleToDelete?.id),
            );
            setRoleToDelete(null);
          }}
          onCancel={() => setRoleToDelete(null)}
        />
      </AlertDialog>
    </>
  );
}
