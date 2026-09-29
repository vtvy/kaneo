import { useMutation, useQueryClient } from "@tanstack/react-query";
import purgeDocument from "@/fetchers/document/purge-document";

function usePurgeDocument(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => purgeDocument(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["document-trash", projectId],
      });
    },
  });
}

export default usePurgeDocument;
