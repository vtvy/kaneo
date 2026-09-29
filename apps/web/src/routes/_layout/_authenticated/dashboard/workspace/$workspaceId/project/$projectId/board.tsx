import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertCircleIcon, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import BoardToolbar from "@/components/board/board-toolbar";
import ProjectLayout from "@/components/common/project-layout";
import KanbanBoard from "@/components/kanban-board";
import ListView from "@/components/list-view";
import PageTitle from "@/components/page-title";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import CreateTaskModal from "@/components/shared/modals/create-task-modal";
import BoardSprintFilter, {
  ALL_SPRINTS_VALUE,
} from "@/components/sprint/board-sprint-filter";
import TaskDetailsSheet from "@/components/task/task-details-sheet";
import { Button } from "@/components/ui/button";
import { shortcuts } from "@/constants/shortcuts";
import useGetLabelsByWorkspace from "@/hooks/queries/label/use-get-labels-by-workspace";
import useGetSprintTasks from "@/hooks/queries/sprint/use-get-sprint-tasks";
import useGetSprintsByProject from "@/hooks/queries/sprint/use-get-sprints-by-project";
import { useGetTasks } from "@/hooks/queries/task/use-get-tasks";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { useRegisterShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useProjectPermission } from "@/hooks/use-project-permission";
import { useTaskFiltersWithLabelsSupport } from "@/hooks/use-task-filters-with-labels-support";
import type { SortConfig } from "@/lib/sort-tasks";
import { sortTasks } from "@/lib/sort-tasks";
import { getCurrentSprint } from "@/lib/sprint";
import useActiveSprintStore from "@/store/active-sprint";
import useProjectStore from "@/store/project";
import { useUserPreferencesStore } from "@/store/user-preferences";

type BoardSearchParams = {
  taskId?: string;
};

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board",
)({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): BoardSearchParams => ({
    taskId: typeof search.taskId === "string" ? search.taskId : undefined,
  }),
});

const skeletonColumns = [
  { key: "col-todo", cards: 3 },
  { key: "col-progress", cards: 4 },
  { key: "col-review", cards: 2 },
  { key: "col-done", cards: 1 },
];

function BoardSkeleton() {
  return (
    <div className="flex h-full w-full gap-4 p-4 overflow-hidden">
      {skeletonColumns.map((col) => (
        <div key={col.key} className="flex w-72 shrink-0 flex-col gap-3">
          <div className="flex items-center gap-2 px-1">
            <div className="h-3 w-3 rounded-full bg-muted animate-pulse" />
            <div className="h-4 w-24 rounded bg-muted animate-pulse" />
            <div className="h-4 w-5 rounded bg-muted animate-pulse" />
          </div>
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: col.cards }, (_, i) => `${col.key}-${i}`).map(
              (cardKey) => (
                <div
                  key={cardKey}
                  className="rounded-lg border border-border bg-card p-3 space-y-2.5"
                >
                  <div className="h-3.5 w-4/5 rounded bg-muted animate-pulse" />
                  <div className="h-3 w-3/5 rounded bg-muted animate-pulse" />
                  <div className="flex items-center gap-2 pt-1">
                    <div className="h-5 w-5 rounded-full bg-muted animate-pulse" />
                    <div className="h-3 w-16 rounded bg-muted animate-pulse" />
                  </div>
                </div>
              ),
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function RouteComponent() {
  const { t } = useTranslation();
  const { projectId, workspaceId } = Route.useParams();
  const { taskId } = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, isError, refetch } = useGetTasks(projectId);
  const { project, setProject } = useProjectStore();
  const { viewMode, setViewMode } = useUserPreferencesStore();
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [boardSearchQuery, setBoardSearchQuery] = useState("");
  const boardSearchInputRef = useRef<HTMLInputElement>(null);
  const [sort, setSort] = useState<SortConfig>({
    field: "position",
    direction: "asc",
  });

  const { data: users } = useGetActiveWorkspaceUsers(workspaceId);
  const { data: workspaceLabels = [] } = useGetLabelsByWorkspace(workspaceId);
  const { can: canProject } = useProjectPermission(projectId);
  const canCreateTask = canProject("item", "create");

  const { data: sprints } = useGetSprintsByProject(projectId);
  // The "current" sprint is derived from the date (today within [start, end]),
  // not a stored/manual state.
  const currentSprint = useMemo(() => getCurrentSprint(sprints), [sprints]);
  const { data: currentSprintTasks } = useGetSprintTasks(
    currentSprint?.id ?? "",
  );
  const currentSprintTaskIds = useMemo(
    () => new Set((currentSprintTasks ?? []).map((task) => task.id)),
    [currentSprintTasks],
  );

  // The board filters to a single sprint. ALL_SPRINTS_VALUE = show everything.
  // Defaults to the current sprint once sprints load (see effect below).
  const [selectedSprintId, setSelectedSprintId] =
    useState<string>(ALL_SPRINTS_VALUE);
  const [hasInitializedSprintFilter, setHasInitializedSprintFilter] =
    useState(false);
  const { setActiveSprint } = useActiveSprintStore();

  // Once sprints are loaded, default the filter to the current sprint (once).
  useEffect(() => {
    if (hasInitializedSprintFilter || !sprints) return;
    setSelectedSprintId(currentSprint?.id ?? ALL_SPRINTS_VALUE);
    setHasInitializedSprintFilter(true);
  }, [sprints, currentSprint, hasInitializedSprintFilter]);

  // If the selected sprint no longer exists (e.g. deleted), fall back to "all".
  useEffect(() => {
    if (selectedSprintId === ALL_SPRINTS_VALUE || !sprints) return;
    if (!sprints.some((sprint) => sprint.id === selectedSprintId)) {
      setSelectedSprintId(ALL_SPRINTS_VALUE);
    }
  }, [sprints, selectedSprintId]);

  const filteredSprintId =
    selectedSprintId === ALL_SPRINTS_VALUE ? "" : selectedSprintId;
  const { data: selectedSprintTasks } = useGetSprintTasks(filteredSprintId);
  const selectedSprintTaskIds = useMemo(
    () => new Set((selectedSprintTasks ?? []).map((task) => task.id)),
    [selectedSprintTasks],
  );

  // Publish the current sprint's task set so task cards can render a badge.
  useEffect(() => {
    if (currentSprint) {
      setActiveSprint({
        projectId,
        sprintName: currentSprint.name,
        taskIds: currentSprintTaskIds,
      });
    } else {
      setActiveSprint(null);
    }
    return () => setActiveSprint(null);
  }, [currentSprint, currentSprintTaskIds, projectId, setActiveSprint]);

  const handleCloseTaskSheet = useCallback(() => {
    navigate({
      to: ".",
      search: {},
      replace: true,
    });
  }, [navigate]);

  useRegisterShortcuts({
    sequentialShortcuts: {
      [shortcuts.view.prefix]: {
        [shortcuts.view.board]: () => setViewMode("board"),
        [shortcuts.view.list]: () => setViewMode("list"),
        [shortcuts.view.gantt]: () =>
          navigate({
            to: "/dashboard/workspace/$workspaceId/project/$projectId/gantt",
            params: { workspaceId, projectId },
          }),
        [shortcuts.view.backlog]: () =>
          navigate({
            to: "/dashboard/workspace/$workspaceId/project/$projectId/backlog",
            params: { workspaceId, projectId },
          }),
      },
    },
  });

  useEffect(() => {
    if (data) {
      setProject(data);
    }
  }, [data, setProject]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isFindShortcut =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f";

      if (!isFindShortcut) return;

      event.preventDefault();
      boardSearchInputRef.current?.focus();
      boardSearchInputRef.current?.select();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const {
    filters,
    updateFilter,
    updateLabelFilter,
    filteredProject,
    hasActiveFilters,
    clearFilters,
  } = useTaskFiltersWithLabelsSupport(
    project,
    projectId,
    boardSearchQuery,
    user?.id,
  );

  const sortedProject = useMemo(() => {
    if (!filteredProject || sort.field === "position") return filteredProject;
    return {
      ...filteredProject,
      columns: filteredProject.columns.map((column) => ({
        ...column,
        tasks: sortTasks(column.tasks, sort),
      })),
    };
  }, [filteredProject, sort]);

  const displayedProject = useMemo(() => {
    if (!sortedProject || selectedSprintId === ALL_SPRINTS_VALUE)
      return sortedProject;
    return {
      ...sortedProject,
      columns: sortedProject.columns.map((column) => ({
        ...column,
        tasks: column.tasks.filter((task) =>
          selectedSprintTaskIds.has(task.id),
        ),
      })),
    };
  }, [sortedProject, selectedSprintId, selectedSprintTaskIds]);

  const boardHeaderActions = (
    <div className="flex items-center gap-2">
      {sprints && sprints.length > 0 && (
        <BoardSprintFilter
          sprints={sprints}
          currentSprintId={currentSprint?.id ?? null}
          value={selectedSprintId}
          onValueChange={setSelectedSprintId}
        />
      )}
      {canCreateTask && (
        <Button
          size="sm"
          className="h-7.5"
          onClick={() => setIsTaskModalOpen(true)}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          {t("tasks:kanban.newTask")}
        </Button>
      )}
    </div>
  );

  return (
    <ProjectLayout
      projectId={projectId}
      workspaceId={workspaceId}
      activeView="board"
      headerActions={boardHeaderActions}
    >
      <PageTitle
        title={`${project?.name} — ${viewMode === "board" ? t("tasks:view.board") : t("tasks:view.list")}`}
        hideAppName
      />
      <div className="relative flex flex-col h-full min-h-0 overflow-hidden">
        <BoardToolbar
          project={project}
          filters={filters}
          updateFilter={updateFilter}
          updateLabelFilter={updateLabelFilter}
          clearFilters={clearFilters}
          hasActiveFilters={hasActiveFilters}
          users={users}
          workspaceLabels={workspaceLabels}
          viewMode={viewMode}
          setViewMode={setViewMode}
          sort={sort}
          onSortChange={setSort}
          searchQuery={boardSearchQuery}
          onSearchQueryChange={setBoardSearchQuery}
          searchInputRef={boardSearchInputRef}
        />

        <div className="flex h-full flex-1 overflow-hidden bg-background">
          {displayedProject ? (
            viewMode === "board" ? (
              <KanbanBoard
                project={displayedProject}
                disableDragDrop={sort.field !== "position"}
              />
            ) : (
              <ListView
                project={displayedProject}
                disableDragDrop={sort.field !== "position"}
              />
            )
          ) : isError ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center">
              <AlertCircleIcon className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {t("common:error.title")}
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                {t("common:error.tryAgain")}
              </Button>
            </div>
          ) : (
            <BoardSkeleton />
          )}
        </div>

        <CreateTaskModal
          open={isTaskModalOpen}
          projectId={projectId}
          onClose={() => setIsTaskModalOpen(false)}
        />

        <TaskDetailsSheet
          taskId={taskId}
          projectId={projectId}
          workspaceId={workspaceId}
          onClose={handleCloseTaskSheet}
        />
      </div>
    </ProjectLayout>
  );
}
