import { useMutation, useQueryClient } from "@tanstack/react-query";
import removeTaskFromSprint from "@/fetchers/sprint/remove-task";

function useRemoveTaskFromSprint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: removeTaskFromSprint,
    onSuccess: (updatedTask, variables) => {
      // The task is back in the backlog now (sprintId = null). Refresh the
      // source sprint's tasks, the backlog, and the board.
      void queryClient.invalidateQueries({
        queryKey: ["sprint-tasks", variables.id],
      });
      void queryClient.invalidateQueries({
        queryKey: ["sprint-backlog", updatedTask.projectId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["tasks", updatedTask.projectId],
      });
      // Refresh the backlog table (all-project-tasks) so the actor's backlog
      // reflects the task returning to the backlog immediately after an edit.
      void queryClient.invalidateQueries({
        queryKey: ["all-project-tasks", updatedTask.projectId],
      });
      // Refresh the single-task query so the properties sidebar / task page
      // reflect that the task is back in the backlog immediately.
      void queryClient.invalidateQueries({
        queryKey: ["task", variables.taskId],
      });
    },
  });
}

export default useRemoveTaskFromSprint;
