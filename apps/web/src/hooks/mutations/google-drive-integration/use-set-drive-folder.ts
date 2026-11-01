import { useMutation, useQueryClient } from "@tanstack/react-query";
import setDriveFolder from "@/fetchers/google-drive-integration/set-drive-folder";

function useSetDriveFolder(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      rootFolderId,
      rootFolderName,
    }: {
      rootFolderId: string;
      rootFolderName: string;
    }) => setDriveFolder(projectId, rootFolderId, rootFolderName),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["drive-status", projectId],
      });
    },
  });
}

export default useSetDriveFolder;
