import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Calendar, CalendarClock, CalendarX, ListChecks } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import PageTitle from "@/components/page-title";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { MyTasksScope } from "@/fetchers/task/get-my-tasks";
import useMyTasks from "@/hooks/queries/task/use-my-tasks";
import { dueDateStatusColors, getDueDateStatus } from "@/lib/due-date-status";
import { formatDateShort } from "@/lib/format";
import { getPriorityLabel } from "@/lib/i18n/domain";
import { getPriorityIcon } from "@/lib/priority";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/my-tasks",
)({
  component: RouteComponent,
});

type MyTask = {
  id: string;
  title: string;
  number: number;
  status: string | null;
  priority: string | null;
  points: number | null;
  dueDate: string | null;
  projectId: string;
  projectName: string;
  projectSlug: string;
  columnId: string | null;
  columnSlug?: string | null;
  columnIsFinal?: boolean | null;
  createdAt: string;
};

type ProjectGroup = {
  projectId: string;
  projectName: string;
  projectSlug: string;
  tasks: MyTask[];
};

function isCompleted(task: MyTask) {
  if (task.columnIsFinal) return true;
  const slug = task.columnSlug?.toLowerCase();
  const status = task.status?.toLowerCase();
  return slug === "done" || status === "done";
}

function RouteComponent() {
  const { t } = useTranslation();
  const { workspaceId } = Route.useParams();
  const navigate = useNavigate();
  const [scope, setScope] = useState<MyTasksScope>("assigned");
  const { data, isLoading, isError } = useMyTasks(workspaceId, scope);

  const tasks = (data ?? []) as unknown as MyTask[];

  const groups = useMemo<ProjectGroup[]>(() => {
    const visible = tasks.filter((task) => !isCompleted(task));

    const byProject = new Map<string, ProjectGroup>();
    for (const task of visible) {
      const existing = byProject.get(task.projectId);
      if (existing) {
        existing.tasks.push(task);
      } else {
        byProject.set(task.projectId, {
          projectId: task.projectId,
          projectName: task.projectName,
          projectSlug: task.projectSlug,
          tasks: [task],
        });
      }
    }

    return Array.from(byProject.values()).sort((a, b) =>
      a.projectName.localeCompare(b.projectName),
    );
  }, [tasks]);

  const handleOpenTask = (task: MyTask) => {
    navigate({
      to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
      params: {
        workspaceId,
        projectId: task.projectId,
        taskId: task.id,
      },
    });
  };

  const hasTasks = groups.length > 0;

  return (
    <>
      <PageTitle title={t("myTasks:title")} />
      <WorkspaceLayout
        title={t("myTasks:title")}
        headerActions={
          <Tabs value={scope} className="w-fit">
            <TabsList variant="underline" className="h-8">
              <TabsTrigger
                value="assigned"
                className="h-7 px-2.5 text-xs"
                onClick={() => setScope("assigned")}
              >
                {t("myTasks:scopeAssigned")}
              </TabsTrigger>
              <TabsTrigger
                value="involved"
                className="h-7 px-2.5 text-xs"
                onClick={() => setScope("involved")}
              >
                {t("myTasks:scopeInvolved")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        }
      >
        <div className="flex h-full flex-col overflow-y-auto bg-card">
          {isLoading ? (
            <div className="flex h-full flex-1 items-center justify-center p-8">
              <div className="h-4 w-40 animate-pulse rounded bg-muted" />
            </div>
          ) : isError ? (
            <div className="flex h-full flex-1 items-center justify-center p-8">
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-destructive/10">
                  <ListChecks className="h-6 w-6 text-destructive" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  {t("myTasks:loadError")}
                </p>
              </div>
            </div>
          ) : !hasTasks ? (
            <div className="flex h-full flex-1 items-center justify-center p-8">
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                  <ListChecks className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  {scope === "involved"
                    ? t("myTasks:emptyInvolved")
                    : t("myTasks:empty")}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col">
              {groups.map((group) => (
                <section key={group.projectId} className="flex flex-col">
                  <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border/80 bg-card/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-card/80">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {group.projectName}
                    </h2>
                    <span className="text-[11px] font-medium text-muted-foreground/70">
                      {group.tasks.length}
                    </span>
                  </div>
                  <ul className="flex flex-col">
                    {group.tasks.map((task) => (
                      <li key={task.id}>
                        <button
                          type="button"
                          onClick={() => handleOpenTask(task)}
                          aria-label={`${group.projectSlug}-${task.number}: ${task.title}`}
                          className="group flex w-full items-center gap-3 border-b border-border/50 px-4 py-2 text-left transition-colors hover:bg-accent/60"
                        >
                          <span className="flex-shrink-0 first:[&_svg]:h-4 first:[&_svg]:w-4">
                            {getPriorityIcon(task.priority ?? "")}
                          </span>
                          <span className="w-16 flex-shrink-0 truncate font-mono text-xs text-muted-foreground">
                            {group.projectSlug}-{task.number}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                            {task.title}
                          </span>
                          {task.priority && (
                            <span className="hidden flex-shrink-0 text-[11px] text-muted-foreground sm:inline">
                              {getPriorityLabel(task.priority)}
                            </span>
                          )}
                          {task.points != null && (
                            <span
                              className="flex-shrink-0 inline-flex items-center rounded border border-border/70 bg-muted/55 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                              title={t("tasks:points.label")}
                            >
                              {t("tasks:points.unit", { n: task.points })}
                            </span>
                          )}
                          {task.dueDate && (
                            <span
                              className={`flex flex-shrink-0 items-center gap-1 rounded px-2 py-1 text-[10px] ${dueDateStatusColors[getDueDateStatus(task.dueDate)]}`}
                            >
                              {getDueDateStatus(task.dueDate) === "overdue" && (
                                <CalendarX className="h-3 w-3" />
                              )}
                              {getDueDateStatus(task.dueDate) ===
                                "due-soon" && (
                                <CalendarClock className="h-3 w-3" />
                              )}
                              {(getDueDateStatus(task.dueDate) ===
                                "far-future" ||
                                getDueDateStatus(task.dueDate) ===
                                  "no-due-date") && (
                                <Calendar className="h-3 w-3" />
                              )}
                              <span>{formatDateShort(task.dueDate)}</span>
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </WorkspaceLayout>
    </>
  );
}
