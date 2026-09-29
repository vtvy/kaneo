import { useNavigate } from "@tanstack/react-router";
import { ArrowRightLeft, MoreHorizontal, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import { cn } from "@/lib/cn";
import { getPriorityIcon } from "@/lib/priority";
import { isCurrentSprint } from "@/lib/sprint";
import type { Sprint, SprintTask } from "@/types/sprint";
import { Button } from "../ui/button";

type SprintTaskRowProps = {
  task: SprintTask;
  projectSlug?: string;
  workspaceId: string;
  projectId: string;
  // Sprints the task can be moved to (used for "assign to sprint" actions).
  sprints?: Sprint[];
  // Sprint the task currently belongs to, if any.
  currentSprintId?: string | null;
  onAssignToSprint?: (sprintId: string) => void;
  onRemoveFromSprint?: () => void;
};

function SprintTaskRow({
  task,
  projectSlug,
  workspaceId,
  projectId,
  sprints = [],
  currentSprintId,
  onAssignToSprint,
  onRemoveFromSprint,
}: SprintTaskRowProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const assignableSprints = sprints.filter(
    (sprint) => sprint.id !== currentSprintId && sprint.state !== "completed",
  );

  const openTask = () => {
    navigate({
      to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
      params: { workspaceId, projectId, taskId: task.id },
    });
  };

  return (
    <div className="group flex items-center gap-2 border-border/50 border-b px-4 py-2 hover:bg-accent/40">
      <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-border/70 bg-muted/55">
        {getPriorityIcon(task.priority ?? "")}
      </span>

      <button
        type="button"
        onClick={openTask}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        {projectSlug && task.number != null && (
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
            {projectSlug}-{task.number}
          </span>
        )}
        <span className="truncate text-sm text-foreground/90">
          {task.title}
        </span>
      </button>

      {task.assigneeName && (
        <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
          {task.assigneeName}
        </span>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className={cn(
                "h-6 w-6 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 data-[popup-open]:opacity-100",
              )}
            />
          }
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {currentSprintId && onRemoveFromSprint && (
            <>
              <DropdownMenuItem onClick={onRemoveFromSprint}>
                <X className="mr-2 h-3.5 w-3.5" />
                {t("common:sprints.moveToBacklog")}
              </DropdownMenuItem>
              {assignableSprints.length > 0 && <DropdownMenuSeparator />}
            </>
          )}

          {assignableSprints.length > 0 && onAssignToSprint && (
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-[11px] uppercase tracking-wide">
                {currentSprintId
                  ? t("common:sprints.moveToSprint")
                  : t("common:sprints.assignToSprint")}
              </DropdownMenuLabel>
              {assignableSprints.map((sprint) => (
                <DropdownMenuItem
                  key={sprint.id}
                  onClick={() => onAssignToSprint(sprint.id)}
                >
                  <ArrowRightLeft className="mr-2 h-3.5 w-3.5" />
                  <span className="truncate">{sprint.name}</span>
                  {isCurrentSprint(sprint) && (
                    <span className="ml-auto text-[10px] text-success-foreground lowercase">
                      {t("common:sprints.current")}
                    </span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          )}

          {assignableSprints.length === 0 && !currentSprintId && (
            <DropdownMenuItem disabled>
              {t("common:sprints.noSprintsAvailable")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default SprintTaskRow;
