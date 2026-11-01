import { useMutation, useQueryClient } from "@tanstack/react-query";
import pushTaskToGitlab from "@/fetchers/task/push-task-to-gitlab";

export function usePushTaskToGitlab(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => pushTaskToGitlab(taskId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["external-links", taskId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["task", taskId],
      });
    },
  });
}
