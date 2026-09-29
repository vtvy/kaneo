import { useQuery } from "@tanstack/react-query";
import getMyTasks, { type MyTasksScope } from "@/fetchers/task/get-my-tasks";

// Global refetchOnMount: false — refetch when opening My Tasks after create
// elsewhere. Same pattern as use-all-project-tasks / use-trash.
export function useMyTasks(
  workspaceId: string,
  scope: MyTasksScope = "assigned",
) {
  return useQuery({
    queryKey: ["my-tasks", workspaceId, scope],
    queryFn: () => getMyTasks(workspaceId, scope),
    enabled: !!workspaceId,
    refetchOnMount: "always",
    staleTime: 0,
  });
}

export default useMyTasks;
