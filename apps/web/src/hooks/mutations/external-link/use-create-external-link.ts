import { useMutation, useQueryClient } from "@tanstack/react-query";
import createExternalLink from "@/fetchers/external-link/create-external-link";

export function useCreateExternalLink(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: { url: string; title?: string }) =>
      createExternalLink(taskId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["external-links", taskId],
      });
    },
  });
}
