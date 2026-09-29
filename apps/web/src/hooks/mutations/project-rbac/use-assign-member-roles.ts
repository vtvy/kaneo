import { useMutation, useQueryClient } from "@tanstack/react-query";
import assignMemberRoles from "@/fetchers/project-rbac/assign-member-roles";

function useAssignMemberRoles(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      memberId,
      roleIds,
    }: {
      memberId: string;
      roleIds: string[];
    }) => assignMemberRoles(projectId, memberId, roleIds),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["project-members", projectId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["project-permissions", projectId],
      });
    },
  });
}

export default useAssignMemberRoles;
