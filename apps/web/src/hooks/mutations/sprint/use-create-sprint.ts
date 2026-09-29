import { useMutation, useQueryClient } from "@tanstack/react-query";
import createSprint from "@/fetchers/sprint/create-sprint";

function useCreateSprint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSprint,
    onSuccess: (createdSprint) => {
      void queryClient.invalidateQueries({
        queryKey: ["sprints", createdSprint.projectId],
      });
    },
  });
}

export default useCreateSprint;
