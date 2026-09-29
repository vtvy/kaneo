import { useMutation, useQueryClient } from "@tanstack/react-query";
import purgeFolder from "@/fetchers/document/purge-folder";

function usePurgeFolder(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => purgeFolder(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["document-trash", projectId],
      });
    },
  });
}

export default usePurgeFolder;
