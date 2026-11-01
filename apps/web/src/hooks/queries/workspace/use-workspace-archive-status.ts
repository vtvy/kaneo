import { useQuery } from "@tanstack/react-query";
import getWorkspaceArchiveStatus from "@/fetchers/workspace/get-workspace-archive-status";

export function useWorkspaceArchiveStatus(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["workspace-archive-status", workspaceId],
    queryFn: () => getWorkspaceArchiveStatus(workspaceId ?? ""),
    enabled: Boolean(workspaceId),
    staleTime: 30_000,
  });
}

export default useWorkspaceArchiveStatus;
