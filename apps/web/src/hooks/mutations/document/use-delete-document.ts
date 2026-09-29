import { useMutation, useQueryClient } from "@tanstack/react-query";
import deleteDocument from "@/fetchers/document/delete-document";

function useDeleteDocument(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteDocument(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["documents", projectId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["document-trash", projectId],
      });
    },
  });
}

export default useDeleteDocument;
