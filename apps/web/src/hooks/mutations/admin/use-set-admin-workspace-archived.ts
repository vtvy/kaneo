import { useMutation, useQueryClient } from "@tanstack/react-query";
import setAdminWorkspaceArchived from "@/fetchers/admin/set-admin-workspace-archived";

export function useSetAdminWorkspaceArchived() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workspaceId,
      archived,
    }: {
      workspaceId: string;
      archived: boolean;
    }) => setAdminWorkspaceArchived(workspaceId, archived),
    onSuccess: (_data, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      queryClient.invalidateQueries({
        queryKey: ["workspace-archive-status", workspaceId],
      });
    },
  });
}

export default useSetAdminWorkspaceArchived;
