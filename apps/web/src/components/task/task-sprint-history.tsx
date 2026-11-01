import { useTranslation } from "react-i18next";
import useGetTaskSprintHistory from "@/hooks/queries/sprint/use-get-task-sprint-history";
import { cn } from "@/lib/cn";

function TaskSprintHistory({ taskId }: { taskId: string }) {
  const { t } = useTranslation();
  const { data: history = [] } = useGetTaskSprintHistory(taskId);

  if (history.length === 0) return null;

  return (
    <ul
      aria-label={t("common:sprints.history")}
      className="flex flex-wrap items-center gap-1.5"
    >
      {history.map((entry) => {
        const current = entry.removedAt == null;
        return (
          <li
            key={entry.sprintId}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]",
              current
                ? "border-primary/40 bg-primary/10 font-medium text-foreground"
                : "border-border text-muted-foreground",
            )}
          >
            {entry.name}
            {current && (
              <span className="lowercase text-primary">
                {t("common:sprints.current")}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default TaskSprintHistory;
