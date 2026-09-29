import { useMutation, useQueryClient } from "@tanstack/react-query";
import deleteSprint from "@/fetchers/sprint/delete-sprint";

function useDeleteSprint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteSprint,
    onSuccess: (deletedSprint) => {
      void queryClient.invalidateQueries({
        queryKey: ["sprints", deletedSprint.projectId],
      });
      // Tasks that belonged to this sprint are now in the backlog (ON DELETE
      // SET NULL), so refresh backlog + board task data too.
      void queryClient.invalidateQueries({
        queryKey: ["sprint-backlog", deletedSprint.projectId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["tasks", deletedSprint.projectId],
      });
    },
  });
}

export default useDeleteSprint;
