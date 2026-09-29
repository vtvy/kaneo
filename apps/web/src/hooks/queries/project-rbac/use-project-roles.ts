import { useQuery } from "@tanstack/react-query";
import getProjectRoles from "@/fetchers/project-rbac/get-project-roles";

function useProjectRoles(projectId?: string) {
  return useQuery({
    queryKey: ["project-roles", projectId],
    enabled: Boolean(projectId),
    queryFn: () => getProjectRoles(projectId as string),
  });
}

export default useProjectRoles;
