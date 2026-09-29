import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  CalendarDays,
  CircleCheck,
  CircleDot,
  LayoutGrid,
  ListTodo,
  TriangleAlert,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import PageTitle from "@/components/page-title";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ErrorDisplay } from "@/components/ui/error-display";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import useWorkspaceDashboard from "@/hooks/queries/dashboard/use-workspace-dashboard";
import { cn } from "@/lib/cn";
import { formatDateMedium } from "@/lib/format";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/overview",
)({
  component: RouteComponent,
});

function percent(completed: number, total: number) {
  if (!total) return 0;
  return Math.round((completed / total) * 100);
}

function daysLeft(endDate: string | null) {
  if (!endDate) return null;
  const end = new Date(endDate);
  if (Number.isNaN(end.getTime())) return null;
  const now = new Date();
  const diff = Math.ceil((end.getTime() - now.getTime()) / 86_400_000);
  return diff;
}

function StatCard({
  label,
  value,
  icon: Icon,
  highlight,
}: {
  label: string;
  value: number;
  icon: typeof ListTodo;
  highlight?: boolean;
}) {
  return (
    <Card
      className={cn(
        "shadow-none",
        highlight && "border-destructive/40 bg-destructive/5",
      )}
    >
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">{label}</span>
          <span
            className={cn(
              "font-semibold text-2xl tabular-nums",
              highlight && "text-destructive-foreground",
            )}
          >
            {value}
          </span>
        </div>
        <Icon
          className={cn(
            "h-5 w-5 text-muted-foreground",
            highlight && "text-destructive-foreground",
          )}
        />
      </CardContent>
    </Card>
  );
}

function RouteComponent() {
  const { t } = useTranslation();
  const { workspaceId } = Route.useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError, error, refetch } =
    useWorkspaceDashboard(workspaceId);

  const title = t("dashboard:title");

  if (isLoading) {
    return (
      <>
        <PageTitle title={title} />
        <WorkspaceLayout title={title}>
          <div className="flex flex-col gap-6 p-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-56 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        </WorkspaceLayout>
      </>
    );
  }

  if (isError || !data) {
    return (
      <>
        <PageTitle title={title} />
        <WorkspaceLayout title={title}>
          <ErrorDisplay
            error={error}
            title={t("dashboard:error")}
            onRetry={() => refetch()}
          />
        </WorkspaceLayout>
      </>
    );
  }

  const { stats, members, activeSprints, projects } = data;
  const hasProjects = projects.length > 0;

  return (
    <>
      <PageTitle title={title} />
      <WorkspaceLayout title={title}>
        {hasProjects ? (
          <div className="flex flex-col gap-6 p-4">
            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                label={t("dashboard:stats.total")}
                value={stats.total}
                icon={ListTodo}
              />
              <StatCard
                label={t("dashboard:stats.open")}
                value={stats.open}
                icon={CircleDot}
              />
              <StatCard
                label={t("dashboard:stats.completed")}
                value={stats.completed}
                icon={CircleCheck}
              />
              <StatCard
                label={t("dashboard:stats.overdue")}
                value={stats.overdue}
                icon={TriangleAlert}
                highlight={stats.overdue > 0}
              />
            </div>

            {/* Active sprints */}
            <section className="flex flex-col gap-3">
              <h2 className="font-medium text-foreground text-sm">
                {t("dashboard:sections.activeSprints")}
              </h2>
              {activeSprints.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {activeSprints.map((sprint) => {
                    const taskPct = percent(
                      sprint.completedTasks,
                      sprint.totalTasks,
                    );
                    const pointPct = percent(
                      sprint.completedPoints,
                      sprint.totalPoints,
                    );
                    const left = daysLeft(sprint.endDate);
                    return (
                      <div
                        key={sprint.id}
                        className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium text-foreground text-sm">
                            {sprint.name}
                          </span>
                          {left !== null && sprint.endDate && (
                            <span
                              className="flex shrink-0 items-center gap-1 text-muted-foreground text-xs"
                              title={formatDateMedium(sprint.endDate)}
                            >
                              <CalendarDays className="h-3.5 w-3.5" />
                              {left >= 0
                                ? t("dashboard:daysLeft", { count: left })
                                : t("dashboard:overdueBy", {
                                    count: Math.abs(left),
                                  })}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                              {t("dashboard:units.tasks")}
                            </span>
                            <span className="text-foreground tabular-nums">
                              {sprint.completedTasks}/{sprint.totalTasks}
                            </span>
                          </div>
                          <Progress value={taskPct} className="h-1.5" />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                              {t("dashboard:units.points")}
                            </span>
                            <span className="text-foreground tabular-nums">
                              {sprint.completedPoints}/{sprint.totalPoints}
                            </span>
                          </div>
                          <Progress value={pointPct} className="h-1.5" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-lg border border-border border-dashed bg-card/40 px-4 py-6 text-center text-muted-foreground text-sm">
                  {t("dashboard:noActiveSprint")}
                </p>
              )}
            </section>

            {/* Member workload */}
            <section className="flex flex-col gap-3">
              <h2 className="font-medium text-foreground text-sm">
                {t("dashboard:sections.memberWorkload")}
              </h2>
              {members.length > 0 ? (
                <div className="overflow-hidden rounded-lg border border-border bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-foreground">
                          {t("dashboard:member.name")}
                        </TableHead>
                        <TableHead className="w-1/2 text-foreground">
                          {t("dashboard:member.workload")}
                        </TableHead>
                        <TableHead className="text-right text-foreground">
                          {t("dashboard:stats.total")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {members.map((member) => {
                        const total = member.total || 1;
                        const openPct = (member.open / total) * 100;
                        const overduePct = (member.overdue / total) * 100;
                        const completedPct = (member.completed / total) * 100;
                        return (
                          <TableRow key={member.userId}>
                            <TableCell className="py-3 font-medium">
                              {member.name}
                            </TableCell>
                            <TableCell className="py-3">
                              <div className="flex flex-col gap-1.5">
                                <div className="flex h-2 w-full overflow-hidden rounded-full bg-input">
                                  {member.open > 0 && (
                                    <div
                                      className="h-full bg-primary"
                                      style={{ width: `${openPct}%` }}
                                    />
                                  )}
                                  {member.overdue > 0 && (
                                    <div
                                      className="h-full bg-destructive"
                                      style={{ width: `${overduePct}%` }}
                                    />
                                  )}
                                  {member.completed > 0 && (
                                    <div
                                      className="h-full bg-emerald-500"
                                      style={{ width: `${completedPct}%` }}
                                    />
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-muted-foreground text-xs">
                                  <span className="flex items-center gap-1">
                                    <span className="h-2 w-2 rounded-full bg-primary" />
                                    {t("dashboard:stats.open")}{" "}
                                    <span className="text-foreground tabular-nums">
                                      {member.open}
                                    </span>
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <span className="h-2 w-2 rounded-full bg-destructive" />
                                    {t("dashboard:stats.overdue")}{" "}
                                    <span className="text-foreground tabular-nums">
                                      {member.overdue}
                                    </span>
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                    {t("dashboard:stats.completed")}{" "}
                                    <span className="text-foreground tabular-nums">
                                      {member.completed}
                                    </span>
                                  </span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="py-3 text-right tabular-nums">
                              {member.total}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="rounded-lg border border-border border-dashed bg-card/40 px-4 py-6 text-center text-muted-foreground text-sm">
                  {t("dashboard:empty")}
                </p>
              )}
            </section>

            {/* Project progress */}
            <section className="flex flex-col gap-3">
              <h2 className="font-medium text-foreground text-sm">
                {t("dashboard:sections.projectProgress")}
              </h2>
              <Card className="shadow-none">
                <CardHeader className="sr-only">
                  <CardTitle>
                    {t("dashboard:sections.projectProgress")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 p-4">
                  {projects.map((project) => {
                    const pct = percent(
                      project.completedTasks,
                      project.totalTasks,
                    );
                    return (
                      <button
                        key={project.id}
                        type="button"
                        onClick={() =>
                          navigate({
                            to: "/dashboard/workspace/$workspaceId/project/$projectId/board",
                            params: { workspaceId, projectId: project.id },
                          })
                        }
                        className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted/50"
                      >
                        <span className="w-40 shrink-0 truncate font-medium text-foreground text-sm">
                          {project.name}
                        </span>
                        <Progress value={pct} className="h-1.5 flex-1" />
                        <span className="w-20 shrink-0 text-right text-muted-foreground text-xs tabular-nums">
                          {project.completedTasks}/{project.totalTasks}
                        </span>
                      </button>
                    );
                  })}
                </CardContent>
              </Card>
            </section>
          </div>
        ) : (
          <Empty className="min-h-[60vh]">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <LayoutGrid />
              </EmptyMedia>
              <EmptyTitle>{t("dashboard:empty")}</EmptyTitle>
              <EmptyDescription>
                {t("dashboard:emptyDescription")}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </WorkspaceLayout>
    </>
  );
}
