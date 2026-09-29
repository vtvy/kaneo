import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateDocument from "@/fetchers/document/update-document";

function useUpdateDocument(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      name,
      folderId,
    }: {
      id: string;
      name?: string;
      folderId?: string | null;
    }) => updateDocument(id, { name, folderId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["documents", projectId],
      });
    },
  });
}

export default useUpdateDocument;
