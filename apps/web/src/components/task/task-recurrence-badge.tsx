import { Repeat } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatRecurrence } from "@/lib/format-recurrence";
import type Task from "@/types/task";

// Plain text so it can sit inside another button, such as the due date one.
export function TaskRecurrenceBadge({
  task,
}: {
  task: Pick<Task, "recurrence">;
}) {
  const { t, i18n } = useTranslation();
  if (!task.recurrence) return null;
  const label = formatRecurrence(t, task.recurrence, i18n.language);

  return (
    <span
      className="inline-flex shrink-0 items-center text-muted-foreground"
      title={label}
    >
      <Repeat className="size-3" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}
