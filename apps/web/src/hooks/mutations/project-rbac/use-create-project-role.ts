import { useMutation, useQueryClient } from "@tanstack/react-query";
import createProjectRole from "@/fetchers/project-rbac/create-project-role";

function useCreateProjectRole(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      name,
      permissions,
    }: {
      name: string;
      permissions: Record<string, string[]>;
    }) => createProjectRole(projectId, name, permissions),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["project-roles", projectId],
      });
    },
  });
}

export default useCreateProjectRole;
