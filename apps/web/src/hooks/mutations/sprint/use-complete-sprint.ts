import { useMutation, useQueryClient } from "@tanstack/react-query";
import completeSprint from "@/fetchers/sprint/complete-sprint";

function useCompleteSprint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: completeSprint,
    onSuccess: (completedSprint) => {
      void queryClient.invalidateQueries({
        queryKey: ["sprints", completedSprint.projectId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["sprint", completedSprint.id],
      });
      // Carry-over moves unfinished tasks back to the backlog (or a target
      // sprint), so refresh sprint tasks, backlog, and the board.
      void queryClient.invalidateQueries({
        queryKey: ["sprint-tasks", completedSprint.id],
      });
      void queryClient.invalidateQueries({
        queryKey: ["sprint-backlog", completedSprint.projectId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["tasks", completedSprint.projectId],
      });
    },
  });
}

export default useCompleteSprint;
