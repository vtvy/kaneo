import { useQuery } from "@tanstack/react-query";
import getTaskByTicketId from "@/fetchers/task/get-task-by-ticket-id";

function useGetTaskByTicketId(workspaceSlug: string, ticketId: string) {
  return useQuery({
    queryKey: ["task-by-ticket-id", workspaceSlug, ticketId],
    queryFn: () => getTaskByTicketId({ workspaceSlug, ticketId }),
    retry: false,
  });
}

export default useGetTaskByTicketId;
