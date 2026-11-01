import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import type { MyTask } from "@/fetchers/task/get-my-tasks";
import { getColumnIcon } from "@/lib/column";
import { getStatusDisplayLabel } from "@/lib/i18n/domain";
import { getPriorityIcon } from "@/lib/priority";
import { DueDateText } from "./due-date-text";
import { SectionHeader } from "./section-header";

type UpNextProps = {
  tasks: MyTask[] | undefined;
  isLoading: boolean;
  isError: boolean;
  workspaceId: string;
};

const VISIBLE_TASKS = 5;

function UpNextRow({
  task,
  workspaceId,
}: {
  task: MyTask;
  workspaceId: string;
}) {
  const status = task.columnSlug ?? task.status ?? "";

  return (
    <Link
      to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
      params={{ workspaceId, projectId: task.projectId, taskId: task.id }}
      className="flex h-11 items-center gap-2.5 border-border/50 border-b px-1 outline-none transition-colors hover:bg-accent/50 focus-visible:bg-accent/50"
    >
      <span className="flex w-4 shrink-0 justify-center [&_svg]:size-3.5">
        {getPriorityIcon(task.priority ?? "")}
      </span>
      <span
        className="shrink-0"
        title={getStatusDisplayLabel(status, task.columnName ?? undefined)}
      >
        {getColumnIcon(status, task.columnIsFinal ?? false, task.columnIcon)}
      </span>
      <span className="hidden w-16 shrink-0 truncate font-medium text-muted-foreground text-xs sm:block">
        {task.projectSlug}-{task.number}
      </span>
      <span className="min-w-0 flex-1 truncate text-foreground text-sm">
        {task.title}
      </span>
      <span className="hidden w-28 shrink-0 truncate text-muted-foreground text-xs sm:block">
        {task.projectName}
      </span>
      <DueDateText
        dueDate={task.dueDate}
        className="shrink-0 text-right sm:w-20"
      />
    </Link>
  );
}

export function UpNext({
  tasks,
  isLoading,
  isError,
  workspaceId,
}: UpNextProps) {
  const { t } = useTranslation();
  const total = tasks?.length ?? 0;

  return (
    <section>
      <SectionHeader
        title={t("workspace:home.upNext.title")}
        detail={
          total > 0
            ? t("workspace:home.upNext.assigned", { count: total })
            : undefined
        }
        action={
          total > 0 ? (
            <Link
              to="/dashboard/workspace/$workspaceId/my-tasks"
              params={{ workspaceId }}
              className="shrink-0 font-medium text-[13px] text-muted-foreground hover:text-foreground"
            >
              {t("workspace:home.upNext.viewAll")}
            </Link>
          ) : null
        }
      />

      {isLoading ? (
        <div className="flex flex-col">
          {[1, 2, 3].map((row) => (
            <div
              key={row}
              className="flex h-11 items-center gap-3 border-border/50 border-b px-1"
            >
              <Skeleton className="size-4 rounded-full" />
              <Skeleton className="h-3.5 w-14" />
              <Skeleton className="h-3.5 flex-1" />
              <Skeleton className="h-3.5 w-16" />
            </div>
          ))}
        </div>
      ) : isError && !tasks ? (
        <p role="alert" className="py-6 text-muted-foreground text-sm">
          {t("myTasks:loadError")}
        </p>
      ) : !tasks?.length ? (
        <p className="py-6 text-muted-foreground text-sm">
          {t("myTasks:empty")}
        </p>
      ) : (
        <div className="flex flex-col">
          {tasks.slice(0, VISIBLE_TASKS).map((task) => (
            <UpNextRow key={task.id} task={task} workspaceId={workspaceId} />
          ))}
        </div>
      )}
    </section>
  );
}
