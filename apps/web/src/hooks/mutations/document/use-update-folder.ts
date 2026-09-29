import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateFolder from "@/fetchers/document/update-folder";

function useUpdateFolder(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      name,
      parentId,
    }: {
      id: string;
      name?: string;
      parentId?: string | null;
    }) => updateFolder(id, { name, parentId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["folders", projectId] });
    },
  });
}

export default useUpdateFolder;
