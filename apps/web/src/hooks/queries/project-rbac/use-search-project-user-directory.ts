import { useQuery } from "@tanstack/react-query";
import searchProjectUserDirectory from "@/fetchers/project-rbac/search-user-directory";

const MIN_QUERY_LENGTH = 1;

function useSearchProjectUserDirectory(
  projectId: string | undefined,
  query: string,
) {
  const trimmed = query.trim();
  const canSearch = Boolean(projectId) && trimmed.length >= MIN_QUERY_LENGTH;

  return useQuery({
    queryKey: ["project-user-directory", projectId, trimmed],
    queryFn: () => searchProjectUserDirectory(projectId as string, trimmed),
    enabled: canSearch,
    staleTime: 30_000,
  });
}

export default useSearchProjectUserDirectory;
