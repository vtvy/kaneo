import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import type { WorkspaceActivity } from "@/fetchers/activity/get-workspace-activities";
import useGetWorkspaceActivities from "@/hooks/queries/activity/use-get-workspace-activities";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { describeActivity } from "./describe-activity";
import { SectionHeader } from "./section-header";

const VISIBLE_ACTIVITIES = 8;

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function ActivityFeedItem({
  activity,
  workspaceId,
}: {
  activity: WorkspaceActivity;
  workspaceId: string;
}) {
  const { t } = useTranslation();
  const actorName =
    activity.userName ||
    activity.externalUserName ||
    t("common:people.someone");

  return (
    <li className="flex gap-2.5">
      <Avatar className="size-6 shrink-0">
        <AvatarImage
          src={activity.userImage ?? activity.externalUserAvatar ?? ""}
          alt=""
        />
        <AvatarFallback className="border border-border/30 font-medium text-[10px]">
          {initialsOf(actorName)}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-[13px] text-muted-foreground leading-[18px]">
          <span className="font-medium text-foreground">{actorName}</span>{" "}
          {describeActivity(activity, t)}
        </p>
        {activity.type === "comment" && activity.excerpt && (
          <p className="line-clamp-3 break-words rounded-lg bg-muted/70 px-2.5 py-2 text-[13px] text-foreground/85 leading-[18px]">
            {activity.excerpt}
          </p>
        )}
        <p className="flex min-w-0 items-center gap-1.5 text-muted-foreground text-xs">
          <Link
            to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
            params={{
              workspaceId,
              projectId: activity.projectId,
              taskId: activity.taskId,
            }}
            className="min-w-0 truncate hover:text-foreground"
          >
            <span className="font-medium">
              {activity.projectSlug}-{activity.taskNumber}
            </span>{" "}
            {activity.taskTitle}
          </Link>
          <span aria-hidden="true">·</span>
          <time
            dateTime={activity.createdAt}
            title={formatDateTime(activity.createdAt)}
            className="shrink-0"
          >
            {formatRelativeTime(activity.createdAt, undefined, new Date(), {
              clampFuture: true,
            })}
          </time>
        </p>
      </div>
    </li>
  );
}

export function ActivityFeed({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  const {
    data: activities,
    isLoading,
    isError,
  } = useGetWorkspaceActivities(workspaceId);

  return (
    <section>
      <SectionHeader title={t("workspace:home.activity.title")} />

      {isLoading ? (
        <div className="flex flex-col gap-4 pt-4">
          {[1, 2, 3].map((row) => (
            <div key={row} className="flex gap-2.5">
              <Skeleton className="size-6 rounded-full" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : isError && !activities ? (
        <p role="alert" className="py-6 text-muted-foreground text-sm">
          {t("workspace:home.activity.loadError")}
        </p>
      ) : !activities?.length ? (
        <p className="py-6 text-muted-foreground text-sm">
          {t("workspace:home.activity.empty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-4 pt-4">
          {activities.slice(0, VISIBLE_ACTIVITIES).map((activity) => (
            <ActivityFeedItem
              key={activity.id}
              activity={activity}
              workspaceId={workspaceId}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
