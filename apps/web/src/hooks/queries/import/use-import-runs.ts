import { useQuery } from "@tanstack/react-query";
import { getImportRuns } from "@/fetchers/import/import";

export function useImportRuns(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["import-runs", workspaceId],
    queryFn: () => getImportRuns(workspaceId ?? ""),
    enabled: Boolean(workspaceId),
    select: (data) => data.runs,
    // Keep a run started elsewhere (another tab or admin) up to date.
    refetchInterval: (query) =>
      query.state.data?.runs.some((run) => run.status === "running")
        ? 5000
        : false,
  });
}
