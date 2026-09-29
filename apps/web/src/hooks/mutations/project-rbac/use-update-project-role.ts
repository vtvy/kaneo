import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateProjectRole from "@/fetchers/project-rbac/update-project-role";

function useUpdateProjectRole(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      roleId,
      name,
      permissions,
    }: {
      roleId: string;
      name?: string;
      permissions?: Record<string, string[]>;
    }) => updateProjectRole(projectId, roleId, { name, permissions }),
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

export default useUpdateProjectRole;
