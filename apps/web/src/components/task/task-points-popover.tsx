import { Check, Hash } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ShortcutNumber } from "@/components/ui/shortcut-number";
import { useUpdateTaskPoints } from "@/hooks/mutations/task/use-update-task-points";
import { useNumberedShortcuts } from "@/hooks/use-numbered-shortcuts";
import { useProjectPermission } from "@/hooks/use-project-permission";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";

type TaskPointsPopoverProps = {
  task: Task;
  children: React.ReactNode;
};

export const POINTS_PRESETS = [1, 2, 3, 5, 8, 13, 21] as const;

export default function TaskPointsPopover({
  task,
  children,
}: TaskPointsPopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { mutateAsync: updateTaskPoints } = useUpdateTaskPoints();
  const { canManageTasks } = useWorkspacePermission();
  const { can: canProject, isCheckingPermissions } = useProjectPermission(
    task.projectId,
  );
  const canEdit =
    canManageTasks() ||
    (!isCheckingPermissions && canProject("item", "update"));

  const handlePointsChange = useCallback(
    async (newPoints: number | null) => {
      try {
        await updateTaskPoints({
          id: task.id,
          projectId: task.projectId,
          points: newPoints,
        });
        setOpen(false);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t("tasks:popover.points.updateError"),
        );
      }
    },
    [t, task.id, task.projectId, updateTaskPoints],
  );

  const options = useMemo(
    () => [...POINTS_PRESETS.map((value) => ({ value })), { value: null }],
    [],
  );

  const shortcutOptions = useMemo(
    () =>
      options.map((option) => ({
        onSelect: () => handlePointsChange(option.value),
      })),
    [options, handlePointsChange],
  );

  useNumberedShortcuts(open, shortcutOptions);

  // Read-only role: render the trigger child as a plain element so the user
  // still sees the current estimate but can't open the popover.
  if (!canEdit) return <>{children}</>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-48 p-0" align="start">
        <div>
          {options.map((option, index) => {
            const isCurrent = (task.points ?? null) === option.value;
            return (
              <Button
                key={option.value ?? "none"}
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 h-8 px-2 rounded-none first:rounded-t-md last:rounded-b-md"
                onClick={() => handlePointsChange(option.value)}
              >
                <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm">
                  {option.value === null
                    ? t("tasks:points.none")
                    : t("tasks:points.value", { n: option.value })}
                </span>
                {isCurrent ? (
                  <Check className="ml-auto h-4 w-4" />
                ) : index < 9 ? (
                  <ShortcutNumber number={index + 1} />
                ) : null}
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
