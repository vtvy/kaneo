import { useQuery } from "@tanstack/react-query";
import getAdminSystemStatus from "@/fetchers/admin/get-admin-system-status";

export function useAdminSystemStatus() {
  return useQuery({
    queryKey: ["admin", "system"],
    queryFn: getAdminSystemStatus,
    refetchInterval: 30_000,
  });
}

export default useAdminSystemStatus;
