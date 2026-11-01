import { useMutation, useQueryClient } from "@tanstack/react-query";
import linkDriveDocument from "@/fetchers/document/link-drive-document";

function useLinkDriveDocument(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      driveFileId,
      folderId,
    }: {
      driveFileId: string;
      folderId: string | null;
    }) => linkDriveDocument(projectId, driveFileId, folderId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["documents", projectId],
      });
    },
  });
}

export default useLinkDriveDocument;
