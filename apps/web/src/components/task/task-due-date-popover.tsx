import { X } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { useUpdateTaskDueDate } from "@/hooks/mutations/task/use-update-task-due-date";
import { useUpdateTaskRecurrence } from "@/hooks/mutations/task/use-update-task-recurrence";
import { useProjectPermission } from "@/hooks/use-project-permission";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { defaultRecurrence } from "@/lib/format-recurrence";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";
import type { TaskRecurrence } from "@/types/task";
import TaskRecurrenceSettings from "./task-recurrence-settings";

type TaskDueDatePopoverProps = {
  task: Task;
  children: React.ReactNode;
};

export default function TaskDueDatePopover({
  task,
  children,
}: TaskDueDatePopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const repeatLabelId = useId();
  const { mutateAsync: updateTaskDueDate } = useUpdateTaskDueDate();
  const { mutateAsync: updateTaskRecurrence } = useUpdateTaskRecurrence();
  const { canManageTasks } = useWorkspacePermission();
  const { can: canProject, isCheckingPermissions } = useProjectPermission(
    task.projectId,
  );
  const canEdit =
    canManageTasks() ||
    (!isCheckingPermissions && canProject("item", "update"));
  const recurrence = task.recurrence ?? null;

  const handleDateChange = async (date: Date | undefined) => {
    try {
      await updateTaskDueDate({
        ...task,
        dueDate: date?.toISOString() || null,
      });
      toast.success(t("tasks:popover.dueDate.updateSuccess"));
      // A repeat rule needs a due date; drop it when the date is cleared.
      if (!date && recurrence) {
        await updateTaskRecurrence({ task, recurrence: null });
      }
      // Keep a repeating task's picker open so its rule stays in view.
      if (!recurrence || !date) setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:popover.dueDate.updateError"),
      );
    }
  };

  const handleRecurrenceChange = async (next: TaskRecurrence | null) => {
    try {
      await updateTaskRecurrence({ task, recurrence: next });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:popover.recurrence.updateError"),
      );
    }
  };

  if (!canEdit) return <>{children}</>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="p-0" align="start">
        <Calendar
          mode="single"
          selected={task.dueDate ? new Date(task.dueDate) : undefined}
          onSelect={handleDateChange}
          disabled={
            task.startDate ? { before: new Date(task.startDate) } : undefined
          }
          className="w-full bg-popover"
        />
        {task.dueDate && (
          <div className="border-t border-border">
            <div className="flex items-center justify-between gap-2 px-3 pt-3 text-sm">
              <span id={repeatLabelId}>
                {t("tasks:popover.recurrence.repeat")}
              </span>
              <Switch
                aria-labelledby={repeatLabelId}
                checked={!!recurrence}
                onCheckedChange={(checked) =>
                  handleRecurrenceChange(checked ? defaultRecurrence() : null)
                }
              />
            </div>
            {recurrence && (
              <TaskRecurrenceSettings
                recurrence={recurrence}
                defaultWeekday={new Date(task.dueDate).getDay()}
                onChange={handleRecurrenceChange}
              />
            )}
          </div>
        )}
        {task.dueDate && (
          <div className="pt-2 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
              onClick={() => handleDateChange(undefined)}
            >
              <X className="h-4 w-4" />
              {t("tasks:popover.dueDate.clear")}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
