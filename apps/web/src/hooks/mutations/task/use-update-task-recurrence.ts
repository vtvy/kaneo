import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateTaskRecurrence from "@/fetchers/task/update-task-recurrence";
import type Task from "@/types/task";
import type { TaskRecurrence } from "@/types/task";

type Variables = { task: Task; recurrence: TaskRecurrence | null };

export function useUpdateTaskRecurrence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ task, recurrence }: Variables) =>
      updateTaskRecurrence(task.id, recurrence),
    // The picker edits the rule in place, so show each change right away.
    onMutate: async ({ task, recurrence }: Variables) => {
      const queryKey = ["task", task.id];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData<Task>(queryKey, (current) =>
        current ? { ...current, recurrence } : current,
      );
      return { previous };
    },
    onError: (_error, { task }, context) => {
      queryClient.setQueryData(["task", task.id], context?.previous);
    },
    onSettled: (_data, _error, { task }) => {
      queryClient.invalidateQueries({ queryKey: ["task", task.id] });
      queryClient.invalidateQueries({ queryKey: ["tasks", task.projectId] });
    },
  });
}
