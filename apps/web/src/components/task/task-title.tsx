import { useCallback, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { Form, FormField } from "@/components/ui/form";
import { useUpdateTaskTitle } from "@/hooks/mutations/task/use-update-task-title";
import useGetTask from "@/hooks/queries/task/use-get-task";
import { useProjectPermission } from "@/hooks/use-project-permission";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import debounce from "@/lib/debounce";

type TaskTitleProps = {
  taskId: string;
};

export default function TaskTitle({ taskId }: TaskTitleProps) {
  const { t } = useTranslation();
  const { data: task } = useGetTask(taskId);
  const { mutateAsync: updateTaskTitle } = useUpdateTaskTitle();
  const { canManageTasks } = useWorkspacePermission();
  const { can: canProject, isCheckingPermissions } = useProjectPermission(
    task?.projectId,
  );
  const canEdit =
    canManageTasks() ||
    (!isCheckingPermissions && canProject("item", "update"));
  const isInitializedRef = useRef(false);
  const taskRef = useRef(task);
  const updateTaskRef = useRef(updateTaskTitle);

  useEffect(() => {
    taskRef.current = task;
    updateTaskRef.current = updateTaskTitle;
  }, [task, updateTaskTitle]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: taskId is not needed here
  useEffect(() => {
    isInitializedRef.current = false;
  }, [taskId]);

  const form = useForm<{
    title: string;
  }>({
    values: {
      title: task?.title || "",
    },
  });

  useEffect(() => {
    if (task?.title !== undefined) isInitializedRef.current = true;
  }, [task?.title]);

  const debouncedUpdate = useCallback(
    debounce(async (title: string) => {
      if (!isInitializedRef.current) return;

      const currentTask = taskRef.current;
      const updateTaskFn = updateTaskRef.current;

      if (!currentTask || !updateTaskFn) return;

      try {
        await updateTaskFn({
          ...currentTask,
          title,
        });
      } catch (error) {
        console.error("Failed to update title:", error);
      }
    }, 800),
    [],
  );

  const handleTitleChange = useCallback(
    (value: string) => {
      if (!isInitializedRef.current) return;

      debouncedUpdate(value);
    },
    [debouncedUpdate],
  );

  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="title"
        render={({ field }) => (
          <textarea
            {...field}
            rows={1}
            placeholder={t("tasks:detail.titlePlaceholder")}
            readOnly={!canEdit}
            className="block field-sizing-content w-full resize-none appearance-none border-0 bg-transparent p-0 font-heading text-[2rem] leading-[1.15] font-semibold tracking-[-0.02em] text-foreground outline-none break-words placeholder:text-foreground/45"
            onChange={(e) => {
              field.onChange(e);
              handleTitleChange(e.target.value);
            }}
            onKeyDown={(e) => {
              // Ignore Enter while an IME composition is active (e.g.
              // Vietnamese/CJK input) so it only confirms the composed text.
              if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229)
                return;
              // Titles are a single logical line: Enter commits instead of
              // inserting a newline; long text still wraps visually.
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
          />
        )}
      />
    </Form>
  );
}
