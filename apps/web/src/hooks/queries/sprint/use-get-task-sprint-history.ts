import { useQuery } from "@tanstack/react-query";
import getTaskSprintHistory from "@/fetchers/sprint/get-task-sprint-history";

function useGetTaskSprintHistory(taskId: string) {
  return useQuery({
    enabled: Boolean(taskId),
    queryKey: ["sprint-history", taskId],
    queryFn: () => getTaskSprintHistory(taskId),
  });
}

export default useGetTaskSprintHistory;
