import { useMutation, useQueryClient } from "@tanstack/react-query";
import deleteAdminWorkspace from "@/fetchers/admin/delete-admin-workspace";

export function useDeleteAdminWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workspaceId,
      confirmName,
    }: {
      workspaceId: string;
      confirmName: string;
    }) => deleteAdminWorkspace(workspaceId, confirmName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
  });
}

export default useDeleteAdminWorkspace;
