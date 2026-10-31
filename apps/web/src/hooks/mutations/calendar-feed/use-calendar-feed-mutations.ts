import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createCalendarFeed,
  regenerateCalendarFeed,
  revokeCalendarFeed,
} from "@/fetchers/calendar-feed/calendar-feeds";

function useInvalidateFeeds(projectId: string) {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: ["calendar-feeds", projectId] });
}

export function useCreateCalendarFeed(projectId: string) {
  const invalidate = useInvalidateFeeds(projectId);
  return useMutation({ mutationFn: createCalendarFeed, onSuccess: invalidate });
}

export function useRegenerateCalendarFeed(projectId: string) {
  const invalidate = useInvalidateFeeds(projectId);
  return useMutation({
    mutationFn: regenerateCalendarFeed,
    onSuccess: invalidate,
  });
}

export function useRevokeCalendarFeed(projectId: string) {
  const invalidate = useInvalidateFeeds(projectId);
  return useMutation({ mutationFn: revokeCalendarFeed, onSuccess: invalidate });
}
