import { useQuery } from "@tanstack/react-query";
import getProjectMembers from "@/fetchers/project-rbac/get-project-members";

function useProjectMembers(projectId?: string) {
  return useQuery({
    queryKey: ["project-members", projectId],
    enabled: Boolean(projectId),
    queryFn: () => getProjectMembers(projectId as string),
  });
}

export default useProjectMembers;
