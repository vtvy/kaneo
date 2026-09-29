import { useMutation, useQueryClient } from "@tanstack/react-query";
import restoreFolder from "@/fetchers/document/restore-folder";

function useRestoreFolder(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => restoreFolder(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["document-trash", projectId],
      });
      void queryClient.invalidateQueries({ queryKey: ["folders", projectId] });
      void queryClient.invalidateQueries({
        queryKey: ["documents", projectId],
      });
    },
  });
}

export default useRestoreFolder;
