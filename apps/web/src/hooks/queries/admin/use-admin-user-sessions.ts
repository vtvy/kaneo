import { useQuery } from "@tanstack/react-query";
import listAdminUserSessions from "@/fetchers/admin/list-admin-user-sessions";

export function useAdminUserSessions(userId: string | null) {
  return useQuery({
    queryKey: ["admin", "users", userId, "sessions"],
    queryFn: () => listAdminUserSessions(userId ?? ""),
    enabled: Boolean(userId),
  });
}

export default useAdminUserSessions;
