import { useQuery } from "@tanstack/react-query";
import getBacklogTasks from "@/fetchers/sprint/get-backlog-tasks";

function useGetBacklogTasks(projectId: string) {
  return useQuery({
    enabled: Boolean(projectId),
    queryKey: ["sprint-backlog", projectId],
    queryFn: () => getBacklogTasks({ projectId }),
  });
}

export default useGetBacklogTasks;
