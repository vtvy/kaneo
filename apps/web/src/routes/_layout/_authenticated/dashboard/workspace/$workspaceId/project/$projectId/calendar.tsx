import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { addMonths, startOfMonth, subMonths } from "date-fns";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import CalendarToolbar from "@/components/calendar/calendar-toolbar";
import MonthAgenda from "@/components/calendar/month-agenda";
import MonthGrid from "@/components/calendar/month-grid";
import { buildMonthWeeks } from "@/components/calendar/month-grid-model";
import SubscribeCalendarDialog from "@/components/calendar/subscribe-calendar-dialog";
import ProjectLayout from "@/components/common/project-layout";
import PageTitle from "@/components/page-title";
import TaskDetailsSheet from "@/components/task/task-details-sheet";
import useGetBacklogTasks from "@/hooks/queries/sprint/use-get-backlog-tasks";
import { useGetTasks } from "@/hooks/queries/task/use-get-tasks";
import { useIsMobile } from "@/hooks/use-mobile";
import { appendUnseenById, partitionBySchedule } from "@/lib/task-schedule";
import { useUserPreferencesStore } from "@/store/user-preferences";

type CalendarSearchParams = {
  taskId?: string;
};

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/calendar",
)({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): CalendarSearchParams => ({
    taskId: typeof search.taskId === "string" ? search.taskId : undefined,
  }),
});

const MAX_LANES_DESKTOP = 3;

function RouteComponent() {
  const { t } = useTranslation();
  const { projectId, workspaceId } = Route.useParams();
  const { taskId } = Route.useSearch();
  const navigate = useNavigate();
  const { data: project, isLoading, isError } = useGetTasks(projectId);
  const { data: backlogTasks = [] } = useGetBacklogTasks(projectId);
  const weekStartsOn = useUserPreferencesStore((state) => state.weekStartsOn);
  const isMobile = useIsMobile();
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(new Date()),
  );

  const { scheduled: scheduledTasks, undated: undatedTasks } = useMemo(() => {
    const onBoard = project?.columns.flatMap((column) => column.tasks) ?? [];
    return partitionBySchedule(appendUnseenById(onBoard, backlogTasks));
  }, [backlogTasks, project]);

  const weeks = useMemo(
    () => buildMonthWeeks(visibleMonth, weekStartsOn),
    [visibleMonth, weekStartsOn],
  );

  const handlePreviousMonth = useCallback(() => {
    setVisibleMonth((current) => subMonths(current, 1));
  }, []);

  const handleNextMonth = useCallback(() => {
    setVisibleMonth((current) => addMonths(current, 1));
  }, []);

  const handleToday = useCallback(() => {
    setVisibleMonth(startOfMonth(new Date()));
  }, []);

  const handleOpenTask = useCallback(
    (id: string) => {
      navigate({
        to: ".",
        search: { taskId: id },
      });
    },
    [navigate],
  );

  const handleCloseTaskSheet = useCallback(() => {
    navigate({
      to: ".",
      search: {},
      replace: true,
    });
  }, [navigate]);

  return (
    <ProjectLayout
      projectId={projectId}
      workspaceId={workspaceId}
      activeView="calendar"
      headerActions={
        <SubscribeCalendarDialog
          projectId={projectId}
          workspaceId={workspaceId}
        />
      }
    >
      <PageTitle title={t("tasks:calendar.title")} />
      <div className="flex h-full min-h-0 flex-col bg-background">
        <CalendarToolbar
          visibleMonth={visibleMonth}
          onPreviousMonth={handlePreviousMonth}
          onNextMonth={handleNextMonth}
          onToday={handleToday}
        />

        {isLoading ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            {t("common:sprints.loading")}
          </div>
        ) : isError ? (
          <div className="flex flex-1 items-center justify-center text-sm text-destructive">
            {t("tasks:calendar.loadError")}
          </div>
        ) : scheduledTasks.length === 0 && undatedTasks.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-6">
            <div className="max-w-sm text-center">
              <h2 className="text-sm font-semibold text-foreground">
                {t("tasks:calendar.noTasks")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("tasks:calendar.noTasksSubtitle")}
              </p>
            </div>
          </div>
        ) : (
          <>
            {scheduledTasks.length === 0 ? null : isMobile ? (
              <MonthAgenda
                tasks={scheduledTasks}
                visibleMonth={visibleMonth}
                projectSlug={project?.slug}
                onOpenTask={handleOpenTask}
              />
            ) : (
              <MonthGrid
                weeks={weeks}
                tasks={scheduledTasks}
                visibleMonth={visibleMonth}
                maxLanes={MAX_LANES_DESKTOP}
                projectSlug={project?.slug}
                onOpenTask={handleOpenTask}
              />
            )}
            {undatedTasks.length > 0 ? (
              <div className="shrink-0 border-t border-border px-3 py-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t("tasks:calendar.undatedHeading")}
                </p>
                <div className="mt-1 flex max-h-40 flex-col overflow-auto">
                  {undatedTasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      className="flex min-h-9 items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-muted"
                      onClick={() => handleOpenTask(task.id)}
                    >
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {project?.slug}-{task.number}
                      </span>
                      <span className="truncate">{task.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>

      {taskId ? (
        <TaskDetailsSheet
          taskId={taskId}
          projectId={projectId}
          workspaceId={workspaceId}
          onClose={handleCloseTaskSheet}
        />
      ) : null}
    </ProjectLayout>
  );
}
