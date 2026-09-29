import { useQuery } from "@tanstack/react-query";
import searchUserDirectory from "@/fetchers/workspace-user/search-user-directory";

const MIN_QUERY_LENGTH = 1;

function useSearchUserDirectory(
  workspaceId: string | undefined,
  query: string,
) {
  const trimmed = query.trim();
  const canSearch = Boolean(workspaceId) && trimmed.length >= MIN_QUERY_LENGTH;

  return useQuery({
    queryKey: ["workspace-user-directory", workspaceId, trimmed],
    queryFn: () => searchUserDirectory(workspaceId as string, trimmed),
    enabled: canSearch,
    staleTime: 30_000,
  });
}

export default useSearchUserDirectory;
