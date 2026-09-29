import { useMutation, useQueryClient } from "@tanstack/react-query";
import restoreDocument from "@/fetchers/document/restore-document";

function useRestoreDocument(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => restoreDocument(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["document-trash", projectId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["documents", projectId],
      });
    },
  });
}

export default useRestoreDocument;
