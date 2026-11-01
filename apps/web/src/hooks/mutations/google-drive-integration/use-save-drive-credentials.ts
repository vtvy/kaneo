import { useMutation, useQueryClient } from "@tanstack/react-query";
import saveDriveCredentials from "@/fetchers/google-drive-integration/save-drive-credentials";

function useSaveDriveCredentials(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      clientId,
      clientSecret,
    }: {
      clientId: string;
      clientSecret: string;
    }) => saveDriveCredentials(projectId, clientId, clientSecret),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["drive-status", projectId],
      });
    },
  });
}

export default useSaveDriveCredentials;
