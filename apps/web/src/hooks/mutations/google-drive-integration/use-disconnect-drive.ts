import { useMutation, useQueryClient } from "@tanstack/react-query";
import disconnectDrive from "@/fetchers/google-drive-integration/disconnect-drive";

function useDisconnectDrive(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => disconnectDrive(projectId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["drive-status", projectId],
      });
    },
  });
}

export default useDisconnectDrive;
