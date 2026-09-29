import { ChevronRight, Plus, SquircleDashed } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import useAssignTaskToSprint from "@/hooks/mutations/sprint/use-assign-task-to-sprint";
import useGetProject from "@/hooks/queries/project/use-get-project";
import useGetBacklogTasks from "@/hooks/queries/sprint/use-get-backlog-tasks";
import useGetSprintsByProject from "@/hooks/queries/sprint/use-get-sprints-by-project";
import { useProjectPermission } from "@/hooks/use-project-permission";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import type { Sprint } from "@/types/sprint";
import SprintCard from "./sprint-card";
import SprintFormModal from "./sprint-form-modal";
import SprintTaskRow from "./sprint-task-row";

type SprintsPanelProps = {
  projectId: string;
  workspaceId: string;
  projectSlug?: string;
};

// Show active first, then planned/future, then completed.
const stateOrder: Record<Sprint["state"], number> = {
  active: 0,
  future: 1,
  completed: 2,
};

function SprintsPanel({
  projectId,
  workspaceId,
  projectSlug,
}: SprintsPanelProps) {
  const { t } = useTranslation();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [backlogExpanded, setBacklogExpanded] = useState(true);
  const { can: canProject, isCheckingPermissions } =
    useProjectPermission(projectId);
  const canCreateSprint =
    !isCheckingPermissions && canProject("sprint", "manage");
  const canManageSprint =
    !isCheckingPermissions &&
    (canProject("sprint", "manage") ||
      canProject("sprint", "start") ||
      canProject("sprint", "complete"));

  const { data: sprints = [], isLoading: sprintsLoading } =
    useGetSprintsByProject(projectId);
  const { data: backlogTasks = [], isLoading: backlogLoading } =
    useGetBacklogTasks(projectId);
  const { data: projectRecord } = useGetProject({
    id: projectId,
    workspaceId,
  });
  const { mutateAsync: assignTask } = useAssignTaskToSprint();

  const sortedSprints = [...sprints].sort(
    (a, b) => stateOrder[a.state] - stateOrder[b.state],
  );
  const futureSprints = sprints.filter((sprint) => sprint.state === "future");

  const handleAssign = async (taskId: string, sprintId: string) => {
    try {
      await assignTask({ id: sprintId, taskId });
      toast.success(t("common:sprints.taskAssigned"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("common:sprints.taskAssignError"),
      );
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-foreground text-lg">
            {t("common:sprints.title")}
          </h1>
          <p className="text-muted-foreground text-xs">
            {t("common:sprints.subtitle")}
          </p>
        </div>
        {canCreateSprint && (
          <Button
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            {t("common:sprints.newSprint")}
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {sprintsLoading ? (
          <div className="h-24 animate-pulse rounded-lg border border-border bg-muted/40" />
        ) : sortedSprints.length > 0 ? (
          sortedSprints.map((sprint) => (
            <SprintCard
              key={sprint.id}
              sprint={sprint}
              projectId={projectId}
              projectSlug={projectSlug}
              workspaceId={workspaceId}
              futureSprints={futureSprints.filter((s) => s.id !== sprint.id)}
              canManage={canManageSprint}
            />
          ))
        ) : (
          <div className="rounded-lg border border-border border-dashed bg-card px-4 py-10 text-center">
            <p className="text-muted-foreground text-sm">
              {t("common:sprints.emptyTitle")}
            </p>
            {canCreateSprint && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCreateOpen(true)}
                className="mt-3 gap-1.5"
              >
                <Plus className="h-4 w-4" />
                {t("common:sprints.createFirst")}
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <button
          type="button"
          onClick={() => setBacklogExpanded((value) => !value)}
          className="flex w-full items-center gap-2 px-4 py-3 text-left"
        >
          <ChevronRight
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              backlogExpanded && "rotate-90",
            )}
          />
          <SquircleDashed className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-foreground text-sm">
            {t("common:sprints.backlog")}
          </span>
          <span className="text-muted-foreground text-xs">
            {backlogTasks.length}
          </span>
        </button>

        {backlogExpanded && (
          <div className="border-border/60 border-t">
            {backlogLoading ? (
              <div className="px-4 py-6 text-center text-muted-foreground text-xs">
                {t("common:sprints.loading")}
              </div>
            ) : backlogTasks.length > 0 ? (
              backlogTasks.map((task) => (
                <SprintTaskRow
                  key={task.id}
                  task={task}
                  projectSlug={projectSlug}
                  workspaceId={workspaceId}
                  projectId={projectId}
                  sprints={sprints}
                  currentSprintId={null}
                  onAssignToSprint={(sprintId) =>
                    handleAssign(task.id, sprintId)
                  }
                />
              ))
            ) : (
              <div className="px-4 py-6 text-center text-muted-foreground text-xs">
                {t("common:sprints.backlogEmpty")}
              </div>
            )}
          </div>
        )}
      </div>

      <SprintFormModal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        projectId={projectId}
        projectSlug={projectSlug}
        sprintCycleWeeks={projectRecord?.sprintCycleWeeks}
      />
    </div>
  );
}

export default SprintsPanel;
