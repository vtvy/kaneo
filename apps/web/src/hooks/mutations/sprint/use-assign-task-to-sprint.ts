import { useMutation, useQueryClient } from "@tanstack/react-query";
import assignTaskToSprint from "@/fetchers/sprint/assign-task";

function useAssignTaskToSprint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: assignTaskToSprint,
    onSuccess: (updatedTask, variables) => {
      // Partial-match invalidation refreshes both the source sprint (when
      // moving task between sprints) and the target sprint task lists.
      void queryClient.invalidateQueries({
        queryKey: ["sprint-tasks"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["sprint-backlog", updatedTask.projectId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["tasks", updatedTask.projectId],
      });
      // Refresh the backlog table (all-project-tasks) so the actor's backlog
      // reflects the new sprint membership immediately after an inline edit.
      void queryClient.invalidateQueries({
        queryKey: ["all-project-tasks", updatedTask.projectId],
      });
      // Refresh the single-task query so the properties sidebar / task page
      // reflect the new sprint membership immediately.
      void queryClient.invalidateQueries({
        queryKey: ["task", variables.taskId],
      });
    },
  });
}

export default useAssignTaskToSprint;
