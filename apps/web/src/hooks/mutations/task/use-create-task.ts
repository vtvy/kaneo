import { useMutation, useQueryClient } from "@tanstack/react-query";
import createTask, {
  type CreateTaskRequest,
} from "@/fetchers/task/create-task";

function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      title,
      description,
      userId,
      projectId,
      status,
      startDate,
      dueDate,
      priority,
      points,
      sprintId,
      createGitlabIssue,
    }: CreateTaskRequest) =>
      createTask(
        title,
        description,
        projectId,
        userId ?? "",
        status,
        startDate ? new Date(startDate) : undefined,
        dueDate ? new Date(dueDate) : undefined,
        priority,
        points,
        sprintId,
        createGitlabIssue,
      ),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["tasks", variables.projectId],
      });
      // The backlog table reads a separate flat list of the project's tasks.
      void queryClient.invalidateQueries({
        queryKey: ["all-project-tasks", variables.projectId],
      });
      // A task created into a sprint changes that sprint's list and totals.
      if (variables.sprintId) {
        void queryClient.invalidateQueries({
          queryKey: ["sprints", variables.projectId],
        });
        void queryClient.invalidateQueries({
          queryKey: ["sprint-tasks", variables.sprintId],
        });
      }
    },
  });
}

export default useCreateTask;
