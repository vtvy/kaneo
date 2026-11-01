import { useQuery } from "@tanstack/react-query";
import getWorkspaceActivities from "@/fetchers/activity/get-workspace-activities";

function useGetWorkspaceActivities(workspaceId: string) {
  return useQuery({
    queryKey: ["workspace-activities", workspaceId],
    queryFn: () => getWorkspaceActivities(workspaceId),
    enabled: !!workspaceId,
    refetchOnMount: "always",
  });
}

export default useGetWorkspaceActivities;
