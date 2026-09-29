import { useQuery } from "@tanstack/react-query";
import getPermissionCatalog from "@/fetchers/project-rbac/get-permission-catalog";

function usePermissionCatalog(projectId?: string) {
  return useQuery({
    queryKey: ["permission-catalog", projectId],
    enabled: Boolean(projectId),
    staleTime: 30 * 60 * 1000,
    queryFn: () => getPermissionCatalog(projectId as string),
  });
}

export default usePermissionCatalog;
