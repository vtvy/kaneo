import { useMutation, useQueryClient } from "@tanstack/react-query";
import removeProjectMember from "@/fetchers/project-rbac/remove-project-member";

function useRemoveProjectMember(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memberId: string) => removeProjectMember(projectId, memberId),
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

export default useRemoveProjectMember;
