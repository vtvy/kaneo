import {
  CalendarDays,
  ChevronRight,
  CircleCheck,
  Pencil,
  Target,
  Trash2,
} from "lucide-react";
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
import useAssignTaskToSprint from "@/hooks/mutations/sprint/use-assign-task-to-sprint";
import useDeleteSprint from "@/hooks/mutations/sprint/use-delete-sprint";
import useRemoveTaskFromSprint from "@/hooks/mutations/sprint/use-remove-task-from-sprint";
import useGetSprintTasks from "@/hooks/queries/sprint/use-get-sprint-tasks";
import { cn } from "@/lib/cn";
import { formatDateMedium } from "@/lib/format";
import { isCurrentSprint } from "@/lib/sprint";
import { toast } from "@/lib/toast";
import type { Sprint } from "@/types/sprint";
import CompleteSprintModal from "./complete-sprint-modal";
import SprintFormModal from "./sprint-form-modal";
import SprintTaskRow from "./sprint-task-row";

type SprintCardProps = {
  sprint: Sprint;
  projectId: string;
  projectSlug?: string;
  workspaceId: string;
  // Future sprints used as carry-over targets when completing, and as
  // "move to sprint" options for the tasks in this sprint.
  futureSprints: Sprint[];
  canManage: boolean;
};

function SprintCard({
  sprint,
  projectId,
  projectSlug,
  workspaceId,
  futureSprints,
  canManage,
}: SprintCardProps) {
  const { t } = useTranslation();
  // "Current" is derived from the date, not a stored/manual state. The current
  // sprint is expanded by default and shows a "Current" badge.
  const isCurrent = isCurrentSprint(sprint);
  const [expanded, setExpanded] = useState(isCurrent);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCompleteOpen, setIsCompleteOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const { data: tasks } = useGetSprintTasks(expanded ? sprint.id : "");
  const { mutateAsync: deleteSprint, isPending: isDeleting } =
    useDeleteSprint();
  const { mutateAsync: assignTask } = useAssignTaskToSprint();
  const { mutateAsync: removeTask } = useRemoveTaskFromSprint();

  const handleMoveTask = async (taskId: string, targetSprintId: string) => {
    try {
      await assignTask({ id: targetSprintId, taskId });
      toast.success(t("common:sprints.taskMoved"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("common:sprints.taskMoveError"),
      );
    }
  };

  const handleRemoveTask = async (taskId: string) => {
    try {
      await removeTask({ id: sprint.id, taskId });
      toast.success(t("common:sprints.taskMovedToBacklog"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("common:sprints.taskRemoveError"),
      );
    }
  };

  const handleDelete = async () => {
    try {
      await deleteSprint({ id: sprint.id });
      toast.success(t("common:sprints.sprintDeleted"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("common:sprints.sprintDeleteError"),
      );
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <ChevronRight
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              expanded && "rotate-90",
            )}
          />
          <span className="truncate font-medium text-foreground text-sm">
            {sprint.name}
          </span>
          {isCurrent ? (
            <Badge variant="success" size="sm" className="shrink-0">
              {t("common:sprints.current")}
            </Badge>
          ) : sprint.state === "completed" ? (
            <Badge variant="outline" size="sm" className="shrink-0">
              {t("common:sprints.stateCompleted")}
            </Badge>
          ) : (
            <Badge variant="secondary" size="sm" className="shrink-0">
              {t("common:sprints.statePlanned")}
            </Badge>
          )}
        </button>

        <div className="flex shrink-0 items-center gap-1">
          {canManage && isCurrent && (
            <Button
              variant="outline"
              size="xs"
              onClick={() => setIsCompleteOpen(true)}
              className="h-7 gap-1.5 px-2 text-xs"
            >
              <CircleCheck className="h-3 w-3" />
              {t("common:sprints.complete")}
            </Button>
          )}
          {canManage && sprint.state !== "completed" && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setIsEditOpen(true)}
              className="h-7 w-7 text-muted-foreground"
              title={t("common:sprints.editSprintTitle")}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {canManage && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setIsDeleteOpen(true)}
              className="h-7 w-7 text-muted-foreground hover:text-destructive-foreground"
              title={t("common:sprints.deleteSprintTitle")}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pb-3 text-xs text-muted-foreground">
        {sprint.goal ? (
          <span className="flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5" />
            {sprint.goal}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 italic">
            <Target className="h-3.5 w-3.5" />
            {t("common:sprints.noGoal")}
          </span>
        )}
        {(sprint.startDate || sprint.endDate) && (
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            {sprint.startDate ? formatDateMedium(sprint.startDate) : "—"}
            {" → "}
            {sprint.endDate ? formatDateMedium(sprint.endDate) : "—"}
          </span>
        )}
      </div>

      {expanded && (
        <div className="border-border/60 border-t">
          {tasks && tasks.length > 0 ? (
            tasks.map((task) => (
              <SprintTaskRow
                key={task.id}
                task={task}
                projectSlug={projectSlug}
                workspaceId={workspaceId}
                projectId={projectId}
                currentSprintId={sprint.id}
                sprints={
                  canManage && sprint.state !== "completed" ? futureSprints : []
                }
                onAssignToSprint={
                  canManage && sprint.state !== "completed"
                    ? (targetSprintId) =>
                        handleMoveTask(task.id, targetSprintId)
                    : undefined
                }
                onRemoveFromSprint={
                  canManage && sprint.state !== "completed"
                    ? () => handleRemoveTask(task.id)
                    : undefined
                }
              />
            ))
          ) : (
            <div className="px-4 py-6 text-center text-muted-foreground text-xs">
              {t("common:sprints.sprintTasksEmpty")}
            </div>
          )}
        </div>
      )}

      <SprintFormModal
        open={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        projectId={projectId}
        projectSlug={projectSlug}
        sprint={sprint}
      />

      <CompleteSprintModal
        open={isCompleteOpen}
        onClose={() => setIsCompleteOpen(false)}
        sprint={sprint}
        futureSprints={futureSprints}
      />

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("common:sprints.deleteSprintTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("common:sprints.deleteSprintDescription", {
                name: sprint.name,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" size="sm" />}>
              {t("common:actions.cancel")}
            </AlertDialogClose>
            <AlertDialogClose
              render={
                <Button variant="destructive" size="sm" disabled={isDeleting} />
              }
              onClick={handleDelete}
            >
              {t("common:actions.delete")}
            </AlertDialogClose>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default SprintCard;
