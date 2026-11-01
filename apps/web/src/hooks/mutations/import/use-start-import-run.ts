import { useMutation, useQueryClient } from "@tanstack/react-query";
import { startImportRun } from "@/fetchers/import/import";

export function useStartImportRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: startImportRun,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["import-runs", variables.workspaceId],
      });
    },
  });
}
