import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import getMyProjectPermissions from "@/fetchers/project-rbac/get-my-project-permissions";

export function useProjectPermission(projectId?: string) {
  const { data, isLoading } = useQuery({
    queryKey: ["project-permissions", projectId],
    enabled: Boolean(projectId),
    staleTime: 5 * 60 * 1000,
    queryFn: () => getMyProjectPermissions(projectId as string),
  });

  const can = useCallback(
    (resource: string, action: string): boolean => {
      if (!data) return false;
      if (data.isOwner) return true;
      const actions = (data.statements as Record<string, string[]>)[resource];
      return actions?.includes(action) ?? false;
    },
    [data],
  );

  return {
    can,
    isOwner: data?.isOwner ?? false,
    statements: (data?.statements as Record<string, string[]>) ?? {},
    isCheckingPermissions: Boolean(projectId) && (isLoading || !data),
  };
}
