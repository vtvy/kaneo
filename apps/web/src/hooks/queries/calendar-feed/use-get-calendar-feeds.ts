import { useQuery } from "@tanstack/react-query";
import { getCalendarFeeds } from "@/fetchers/calendar-feed/calendar-feeds";

function useGetCalendarFeeds(projectId: string, enabled = true) {
  return useQuery({
    queryKey: ["calendar-feeds", projectId],
    queryFn: () => getCalendarFeeds(projectId),
    enabled: enabled && Boolean(projectId),
  });
}

export default useGetCalendarFeeds;
