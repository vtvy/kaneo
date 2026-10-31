import { keepPreviousData, useQuery } from "@tanstack/react-query";
import listAdminAuditLog, {
  type ListAdminAuditLogQuery,
} from "@/fetchers/admin/list-admin-audit-log";

export function useAdminAuditLog(query: ListAdminAuditLogQuery) {
  return useQuery({
    queryKey: ["admin", "audit-log", query],
    queryFn: () => listAdminAuditLog(query),
    placeholderData: keepPreviousData,
  });
}

export default useAdminAuditLog;
