import { useQuery } from "@tanstack/react-query";
import getMyTasks, { type MyTasksScope } from "@/fetchers/task/get-my-tasks";

// Global refetchOnMount: false — refetch when opening My Tasks after create
// elsewhere. Same pattern as use-all-project-tasks / use-trash.
// `open` (Home) keeps only unfinished tasks; it shares the ["my-tasks"] prefix
// so existing invalidations refresh Home too.
export function useMyTasks(
  workspaceId: string,
  scope: MyTasksScope = "assigned",
  options: { open?: boolean } = {},
) {
  const open = options.open ?? false;
  return useQuery({
    queryKey: open
      ? ["my-tasks", workspaceId, scope, "open"]
      : ["my-tasks", workspaceId, scope],
    queryFn: () => getMyTasks(workspaceId, scope, { open }),
    enabled: !!workspaceId,
    refetchOnMount: "always",
    staleTime: 0,
  });
}

export default useMyTasks;
