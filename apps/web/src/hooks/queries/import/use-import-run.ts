import { useQuery } from "@tanstack/react-query";
import { getImportRun } from "@/fetchers/import/import";

const POLL_MS = 2000;

// Polls while the import runs in the background, then stops.
export function useImportRun(
  workspaceId: string | undefined,
  runId: string | null,
) {
  return useQuery({
    queryKey: ["import-run", workspaceId, runId],
    queryFn: () => getImportRun(workspaceId ?? "", runId ?? ""),
    enabled: Boolean(workspaceId && runId),
    select: (data) => data.run,
    refetchInterval: (query) =>
      query.state.data?.run.status === "running" ? POLL_MS : false,
  });
}
