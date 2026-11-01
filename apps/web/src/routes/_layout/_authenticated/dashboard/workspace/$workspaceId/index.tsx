import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import { ActivityFeed } from "@/components/home/activity-feed";
import { getDayPart } from "@/components/home/day-part";
import { HomeProjects } from "@/components/home/home-projects";
import { UpNext } from "@/components/home/up-next";
import { WeekStrip } from "@/components/home/week-strip";
import PageTitle from "@/components/page-title";
import useMyTasks from "@/hooks/queries/task/use-my-tasks";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/",
)({
  component: RouteComponent,
});

// Personal landing page. The team-wide view stays at /overview.
function RouteComponent() {
  const { t } = useTranslation();
  const { workspaceId } = Route.useParams();
  const {
    data: tasks,
    isLoading,
    isError,
  } = useMyTasks(workspaceId, "assigned", { open: true });

  const greetings = {
    morning: t("workspace:home.greeting.morning"),
    afternoon: t("workspace:home.greeting.afternoon"),
    evening: t("workspace:home.greeting.evening"),
  };

  return (
    <>
      <PageTitle title={t("workspace:home.pageTitle")} />
      <WorkspaceLayout title={t("workspace:home.pageTitle")}>
        <div className="h-full overflow-y-auto">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-9 px-4 py-6 sm:px-6 sm:py-10 lg:px-10">
            <header className="flex flex-col gap-1.5">
              <p className="font-medium text-[13px] text-muted-foreground">
                {formatDate(new Date(), {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              <h1 className="font-semibold text-3xl text-foreground tracking-tight">
                {greetings[getDayPart()]}
              </h1>
            </header>

            <WeekStrip tasks={tasks ?? []} workspaceId={workspaceId} />

            <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <div className="flex min-w-0 flex-col gap-9">
                <UpNext
                  tasks={tasks}
                  isLoading={isLoading}
                  isError={isError}
                  workspaceId={workspaceId}
                />
                <HomeProjects workspaceId={workspaceId} />
              </div>
              <ActivityFeed workspaceId={workspaceId} />
            </div>
          </div>
        </div>
      </WorkspaceLayout>
    </>
  );
}
