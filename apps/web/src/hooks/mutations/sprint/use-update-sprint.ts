import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateSprint from "@/fetchers/sprint/update-sprint";

function useUpdateSprint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateSprint,
    onSuccess: (updatedSprint) => {
      void queryClient.invalidateQueries({
        queryKey: ["sprints", updatedSprint.projectId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["sprint", updatedSprint.id],
      });
    },
  });
}

export default useUpdateSprint;
