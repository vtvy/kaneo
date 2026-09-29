import { useMutation, useQueryClient } from "@tanstack/react-query";
import createFolder from "@/fetchers/document/create-folder";

function useCreateFolder(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      name,
      parentId,
    }: {
      name: string;
      parentId: string | null;
    }) => createFolder(projectId, name, parentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["folders", projectId] });
    },
  });
}

export default useCreateFolder;
