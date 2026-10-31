import { useQuery } from "@tanstack/react-query";
import listAdminUserApiKeys from "@/fetchers/admin/list-admin-user-api-keys";

export function useAdminUserApiKeys(userId: string | null) {
  return useQuery({
    queryKey: ["admin", "users", userId, "api-keys"],
    queryFn: () => listAdminUserApiKeys(userId ?? ""),
    enabled: Boolean(userId),
  });
}

export default useAdminUserApiKeys;
