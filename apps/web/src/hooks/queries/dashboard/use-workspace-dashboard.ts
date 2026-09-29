import { useQuery } from "@tanstack/react-query";
import getWorkspaceDashboard from "@/fetchers/dashboard/get-workspace-dashboard";

function useWorkspaceDashboard(workspaceId: string) {
  return useQuery({
    enabled: Boolean(workspaceId),
    queryKey: ["workspace-dashboard", workspaceId],
    queryFn: () => getWorkspaceDashboard(workspaceId),
    refetchOnMount: "always",
    staleTime: 0,
  });
}

export default useWorkspaceDashboard;
