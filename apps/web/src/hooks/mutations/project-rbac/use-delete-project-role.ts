import { useMutation, useQueryClient } from "@tanstack/react-query";
import deleteProjectRole from "@/fetchers/project-rbac/delete-project-role";

function useDeleteProjectRole(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (roleId: string) => deleteProjectRole(projectId, roleId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["project-roles", projectId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["project-permissions", projectId],
      });
    },
  });
}

export default useDeleteProjectRole;
