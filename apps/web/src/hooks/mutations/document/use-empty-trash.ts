import { useMutation, useQueryClient } from "@tanstack/react-query";
import emptyTrash from "@/fetchers/document/empty-trash";

function useEmptyTrash(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => emptyTrash(projectId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["document-trash", projectId],
      });
    },
  });
}

export default useEmptyTrash;
