import { keepPreviousData, useQuery } from "@tanstack/react-query";
import listAdminWorkspaces, {
  type ListAdminWorkspacesQuery,
} from "@/fetchers/admin/list-admin-workspaces";

export function useAdminWorkspaces(query: ListAdminWorkspacesQuery) {
  return useQuery({
    queryKey: ["admin", "workspaces", query],
    queryFn: () => listAdminWorkspaces(query),
    placeholderData: keepPreviousData,
  });
}

export default useAdminWorkspaces;
