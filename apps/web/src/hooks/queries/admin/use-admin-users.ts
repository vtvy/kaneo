import { keepPreviousData, useQuery } from "@tanstack/react-query";
import listAdminUsers, {
  type ListAdminUsersQuery,
} from "@/fetchers/admin/list-admin-users";

export function useAdminUsers(query: ListAdminUsersQuery) {
  return useQuery({
    queryKey: ["admin", "users", query],
    queryFn: () => listAdminUsers(query),
    placeholderData: keepPreviousData,
  });
}

export default useAdminUsers;
