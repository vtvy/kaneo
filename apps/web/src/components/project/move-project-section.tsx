import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useId, useMemo, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import useMoveProject from "@/hooks/mutations/project/use-move-project";
import useGetWorkspaces from "@/hooks/queries/workspace/use-get-workspaces";
import { useWorkspacesWithPermission } from "@/hooks/queries/workspace/use-workspaces-with-permission";
import { authClient } from "@/lib/auth-client";
import { toast } from "@/lib/toast";

// Module-level so its identity stays stable across renders.
const PROJECT_CREATE = { project: ["create"] };

type MoveProjectSectionProps = {
  project: { id: string; name: string; workspaceId: string };
};

export function MoveProjectSection({ project }: MoveProjectSectionProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const selectId = useId();
  const [open, setOpen] = useState(false);
  const [targetWorkspaceId, setTargetWorkspaceId] = useState("");
  const { mutateAsync: moveProject, isPending } = useMoveProject();

  // The API also requires project creation in the target, so only offer
  // workspaces where that check passes.
  const { data: workspaces } = useGetWorkspaces();
  const candidates = useMemo(
    () => (workspaces ?? []).filter((item) => item.id !== project.workspaceId),
    [workspaces, project.workspaceId],
  );
  const candidateIds = useMemo(
    () => candidates.map((item) => item.id),
    [candidates],
  );
  const { allowed, isError } = useWorkspacesWithPermission(
    candidateIds,
    PROJECT_CREATE,
  );
  const targets = useMemo(
    () => candidates.filter((item) => allowed.has(item.id)),
    [candidates, allowed],
  );
  const target = targets.find((item) => item.id === targetWorkspaceId);

  if (targets.length === 0 && !isError) return null;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setTargetWorkspaceId("");
  };

  const handleMove = async () => {
    if (!target) return;

    try {
      const moved = await moveProject({
        id: project.id,
        workspaceId: target.id,
      });
      toast.success(
        t("settings:projectGeneral.move.toastMoved", {
          workspace: target.name,
          taskCount: moved.unassignedTaskCount,
          memberCount: moved.removedMemberCount,
        }),
      );
      handleOpenChange(false);

      await authClient.organization.setActive({ organizationId: target.id });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      navigate({
        to: "/dashboard/workspace/$workspaceId/project/$projectId",
        params: { workspaceId: target.id, projectId: project.id },
      });
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t("settings:projectGeneral.move.toastError"),
      );
    }
  };

  return (
    <div className="flex items-center justify-between border border-border rounded-md p-4 bg-sidebar">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">
          {t("settings:projectGeneral.move.title")}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("settings:projectGeneral.move.description")}
        </p>
      </div>
      {isError ? (
        <p className="max-w-64 text-xs text-destructive">
          {t("settings:projectGeneral.move.targetsError")}
        </p>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(true)}
        >
          {t("settings:projectGeneral.move.action")}
        </Button>
      )}

      <AlertDialog open={open} onOpenChange={handleOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("settings:projectGeneral.move.dialogTitle", {
                name: project.name,
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings:projectGeneral.move.dialogDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 px-6 pb-6">
            <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
              <li>{t("settings:projectGeneral.move.consequenceMembers")}</li>
              <li>{t("settings:projectGeneral.move.consequenceAssignees")}</li>
              <li>{t("settings:projectGeneral.move.consequenceLabels")}</li>
              <li>
                {t("settings:projectGeneral.move.consequenceIntegrations")}
              </li>
            </ul>
            <div className="space-y-2">
              <Label htmlFor={selectId}>
                {t("settings:projectGeneral.move.targetLabel")}
              </Label>
              <Select
                value={targetWorkspaceId}
                onValueChange={(value) => setTargetWorkspaceId(value ?? "")}
              >
                <SelectTrigger id={selectId}>
                  <SelectValue
                    placeholder={t(
                      "settings:projectGeneral.move.targetPlaceholder",
                    )}
                  >
                    {target?.name ??
                      t("settings:projectGeneral.move.targetPlaceholder")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {targets.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogClose>
              <Button variant="outline" size="sm">
                {t("common:actions.cancel")}
              </Button>
            </AlertDialogClose>
            <Button
              size="sm"
              onClick={handleMove}
              disabled={!target || isPending}
            >
              {isPending
                ? t("settings:projectGeneral.move.moving")
                : t("settings:projectGeneral.move.confirm")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
