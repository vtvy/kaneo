import { Check, SquircleDashed, Target } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import useAssignTaskToSprint from "@/hooks/mutations/sprint/use-assign-task-to-sprint";
import useRemoveTaskFromSprint from "@/hooks/mutations/sprint/use-remove-task-from-sprint";
import useGetSprintsByProject from "@/hooks/queries/sprint/use-get-sprints-by-project";
import { useProjectPermission } from "@/hooks/use-project-permission";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import type { Sprint } from "@/types/sprint";
import type Task from "@/types/task";

// Show active first, then planned/future, then completed.
const stateOrder: Record<Sprint["state"], number> = {
  active: 0,
  future: 1,
  completed: 2,
};

const stateLabelKeys: Record<Sprint["state"], string> = {
  active: "common:sprints.stateActive",
  future: "common:sprints.stateFuture",
  completed: "common:sprints.stateCompleted",
};

type TaskSprintPopoverProps = {
  task: Task;
  children: React.ReactNode;
};

export default function TaskSprintPopover({
  task,
  children,
}: TaskSprintPopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { data: sprints = [] } = useGetSprintsByProject(task.projectId);
  const { mutateAsync: assignTaskToSprint } = useAssignTaskToSprint();
  const { mutateAsync: removeTaskFromSprint } = useRemoveTaskFromSprint();
  const { canManageTasks } = useWorkspacePermission();
  const { can: canProject, isCheckingPermissions } = useProjectPermission(
    task.projectId,
  );
  // Match the other inline-edit popovers (status/priority/assignee): a workspace
  // task-manager can edit even without project-level item:update.
  const canEdit =
    canManageTasks() ||
    (!isCheckingPermissions && canProject("item", "update"));

  const groupedSprints = useMemo(() => {
    const sorted = [...sprints].sort(
      (a, b) => stateOrder[a.state] - stateOrder[b.state],
    );
    const groups: { state: Sprint["state"]; sprints: Sprint[] }[] = [];
    for (const sprint of sorted) {
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.state === sprint.state) {
        lastGroup.sprints.push(sprint);
      } else {
        groups.push({ state: sprint.state, sprints: [sprint] });
      }
    }
    return groups;
  }, [sprints]);

  const handleAssign = useCallback(
    async (sprintId: string) => {
      if (task.sprintId === sprintId) {
        setOpen(false);
        return;
      }
      try {
        await assignTaskToSprint({ id: sprintId, taskId: task.id });
        toast.success(t("common:sprints.taskAssigned"));
        setOpen(false);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t("common:sprints.taskAssignError"),
        );
      }
    },
    [assignTaskToSprint, task.id, task.sprintId, t],
  );

  const handleClear = useCallback(async () => {
    if (!task.sprintId) {
      setOpen(false);
      return;
    }
    try {
      await removeTaskFromSprint({ id: task.sprintId, taskId: task.id });
      toast.success(t("common:sprints.taskMovedToBacklog"));
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("common:sprints.taskRemoveError"),
      );
    }
  }, [removeTaskFromSprint, task.id, task.sprintId, t]);

  if (!canEdit) return <>{children}</>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <div className="max-h-80 space-y-1 overflow-y-auto p-1">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 h-8 px-2"
            onClick={handleClear}
          >
            <SquircleDashed className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              {t("common:sprints.noSprintBacklog")}
            </span>
            {!task.sprintId && <Check className="ml-auto h-4 w-4 shrink-0" />}
          </Button>

          {sprints.length === 0 ? (
            <div className="px-2 py-4 text-center text-muted-foreground text-xs">
              {t("common:sprints.noSprintsYetCreate")}
            </div>
          ) : (
            groupedSprints.map((group) => (
              <div key={group.state}>
                <div className="px-2 pt-1.5 pb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t(stateLabelKeys[group.state])}
                </div>
                {group.sprints.map((sprint) => (
                  <Button
                    key={sprint.id}
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "w-full justify-start gap-2 h-8 px-2",
                      sprint.state === "completed" && "text-muted-foreground",
                    )}
                    onClick={() => handleAssign(sprint.id)}
                  >
                    <Target className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate">{sprint.name}</span>
                    {task.sprintId === sprint.id && (
                      <Check className="ml-auto h-4 w-4 shrink-0" />
                    )}
                  </Button>
                ))}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
