import { useMutation, useQueryClient } from "@tanstack/react-query";
import deleteExternalLink from "@/fetchers/external-link/delete-external-link";

export function useDeleteExternalLink(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteExternalLink(taskId, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["external-links", taskId],
      });
    },
  });
}
