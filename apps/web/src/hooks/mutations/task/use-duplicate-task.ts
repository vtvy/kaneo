import { useMutation, useQueryClient } from "@tanstack/react-query";
import duplicateTask from "@/fetchers/task/duplicate-task";

export function useDuplicateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: duplicateTask,
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: ["tasks", task.projectId] });
      queryClient.invalidateQueries({
        queryKey: ["all-project-tasks", task.projectId],
      });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}
