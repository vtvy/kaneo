import { useMutation, useQueryClient } from "@tanstack/react-query";
import deleteFolder from "@/fetchers/document/delete-folder";

function useDeleteFolder(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteFolder(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["folders", projectId] });
      void queryClient.invalidateQueries({
        queryKey: ["documents", projectId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["document-trash", projectId],
      });
    },
  });
}

export default useDeleteFolder;
