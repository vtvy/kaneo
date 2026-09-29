import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateTaskPoints from "@/fetchers/task/update-task-points";

type UpdateTaskPointsVariables = {
  id: string;
  projectId: string;
  points: number | null;
};

export function useUpdateTaskPoints() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, points }: UpdateTaskPointsVariables) =>
      updateTaskPoints(id, points),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["task", variables.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["tasks", variables.projectId],
      });
      // Backlog (Notion-style flat table) reads points from this key too — keep
      // the estimate live there as well, matching the other task-field mutations.
      queryClient.invalidateQueries({
        queryKey: ["all-project-tasks", variables.projectId],
      });
      queryClient.invalidateQueries({
        queryKey: ["notifications"],
      });
      queryClient.invalidateQueries({
        queryKey: ["projects"],
      });
      queryClient.invalidateQueries({
        queryKey: ["activities", variables.id],
      });
    },
  });
}
