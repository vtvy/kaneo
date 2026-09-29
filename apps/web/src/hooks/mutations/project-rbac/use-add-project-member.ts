import { useMutation, useQueryClient } from "@tanstack/react-query";
import addProjectMember from "@/fetchers/project-rbac/add-project-member";

function useAddProjectMember(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      email,
      roleNames,
    }: {
      email: string;
      roleNames?: string[];
    }) => addProjectMember(projectId, email, roleNames),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["project-members", projectId],
      });
    },
  });
}

export default useAddProjectMember;
