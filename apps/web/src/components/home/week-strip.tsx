import { Link } from "@tanstack/react-router";
import { useLayoutEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { MyTask } from "@/fetchers/task/get-my-tasks";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { buildWeek } from "./build-week";

type WeekStripProps = {
  tasks: MyTask[];
  workspaceId: string;
};

const VISIBLE_TASKS_PER_DAY = 2;

export function WeekStrip({ tasks, workspaceId }: WeekStripProps) {
  const { t } = useTranslation();
  // Calendar day key: the strip rebuilds when the viewer's day rolls over.
  const day = new Date().toDateString();
  const week = useMemo(() => buildWeek(tasks, new Date(day)), [tasks, day]);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLLIElement>(null);

  // On narrow screens the strip scrolls; open it centred on today rather than
  // on the oldest past day.
  // biome-ignore lint/correctness/useExhaustiveDependencies: recentre when the day changes
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const todayCell = todayRef.current;
    if (!scroller || !todayCell) return;
    scroller.scrollLeft =
      todayCell.offsetLeft - (scroller.clientWidth - todayCell.offsetWidth) / 2;
  }, [day]);

  return (
    <div
      ref={scrollerRef}
      className="relative overflow-x-auto rounded-xl border border-border bg-card"
    >
      <ol className="flex min-w-[46rem] divide-x divide-border/70">
        {week.map((weekDay) => (
          <li
            key={weekDay.date.toISOString()}
            ref={weekDay.isToday ? todayRef : undefined}
            className={cn(
              "flex min-h-28 min-w-0 flex-1 flex-col gap-2.5 px-3 py-3",
              weekDay.isToday && "bg-muted/50",
            )}
          >
            <div className="flex items-center gap-1.5 text-xs">
              {weekDay.isToday ? (
                <>
                  <span className="font-semibold text-foreground">
                    {t("workspace:home.due.today")}
                  </span>
                  {weekDay.tasks.length > 0 && (
                    <span className="flex size-4.5 items-center justify-center rounded-full bg-foreground font-semibold text-[11px] text-background tabular-nums">
                      {weekDay.tasks.length}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className="font-medium text-muted-foreground">
                    {formatDate(weekDay.date, { weekday: "short" })}
                  </span>
                  <span className="text-muted-foreground/80 tabular-nums">
                    {formatDate(weekDay.date, { day: "numeric" })}
                  </span>
                </>
              )}
            </div>

            <div className="flex flex-col gap-1">
              {weekDay.tasks.slice(0, VISIBLE_TASKS_PER_DAY).map((task) => (
                <Link
                  key={task.id}
                  to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
                  params={{
                    workspaceId,
                    projectId: task.projectId,
                    taskId: task.id,
                  }}
                  className={cn(
                    "flex flex-col gap-0.5 rounded-md px-2 py-1.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    weekDay.isPast
                      ? "bg-destructive/8 hover:bg-destructive/12"
                      : weekDay.isToday
                        ? "border border-border bg-background hover:bg-accent/50"
                        : "bg-muted/70 hover:bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "font-medium text-[11px]",
                      weekDay.isPast
                        ? "text-destructive"
                        : "text-muted-foreground",
                    )}
                  >
                    {weekDay.isPast
                      ? t("workspace:home.due.overdue")
                      : `${task.projectSlug}-${task.number}`}
                  </span>
                  <span className="truncate text-foreground text-xs">
                    {task.title}
                  </span>
                </Link>
              ))}
              {weekDay.tasks.length > VISIBLE_TASKS_PER_DAY && (
                <span className="px-2 font-medium text-[11px] text-muted-foreground">
                  {t("workspace:home.week.more", {
                    count: weekDay.tasks.length - VISIBLE_TASKS_PER_DAY,
                  })}
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
