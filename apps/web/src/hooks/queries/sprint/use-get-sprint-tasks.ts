import { useQuery } from "@tanstack/react-query";
import getSprintTasks from "@/fetchers/sprint/get-sprint-tasks";

// Global refetchOnMount: false — board sprint filter depends on this list.
function useGetSprintTasks(id: string) {
  return useQuery({
    enabled: Boolean(id),
    queryKey: ["sprint-tasks", id],
    queryFn: () => getSprintTasks({ id }),
    refetchOnMount: "always",
    staleTime: 0,
  });
}

export default useGetSprintTasks;
