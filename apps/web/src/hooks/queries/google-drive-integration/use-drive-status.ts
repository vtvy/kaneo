import { useQuery } from "@tanstack/react-query";
import getDriveStatus from "@/fetchers/google-drive-integration/get-drive-status";

function useDriveStatus(projectId?: string) {
  return useQuery({
    queryKey: ["drive-status", projectId],
    enabled: Boolean(projectId),
    queryFn: () => getDriveStatus(projectId as string),
  });
}

export default useDriveStatus;
