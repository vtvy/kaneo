import { useQuery } from "@tanstack/react-query";
import getAllProjectTasks from "@/fetchers/task/get-all-project-tasks";

// Global queryClient sets refetchOnMount: false, so a query invalidated while
// inactive (e.g. create task on board, then open backlog) would keep serving
// stale cache until a hard refresh. Force a fresh fetch on mount — same pattern
// as use-trash / use-get-task.
export function useAllProjectTasks(projectId: string) {
  return useQuery({
    queryKey: ["all-project-tasks", projectId],
    queryFn: () => getAllProjectTasks(projectId),
    enabled: !!projectId,
    refetchOnMount: "always",
    staleTime: 0,
  });
}
