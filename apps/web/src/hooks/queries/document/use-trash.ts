import { useQuery } from "@tanstack/react-query";
import listTrash from "@/fetchers/document/list-trash";

// `enabled` lets callers defer the trash fetch until the Trash view is opened.
// The global queryClient sets refetchOnMount: false, so a query invalidated
// while inactive (e.g. trashing a file before the Trash view is open) won't
// refetch on mount. Force a fresh fetch each time the Trash view opens so newly
// trashed items appear immediately (mirrors use-get-task).
function useTrash(projectId?: string, enabled = true) {
  return useQuery({
    queryKey: ["document-trash", projectId],
    enabled: Boolean(projectId) && enabled,
    queryFn: () => listTrash(projectId as string),
    refetchOnMount: "always",
    staleTime: 0,
  });
}

export default useTrash;
