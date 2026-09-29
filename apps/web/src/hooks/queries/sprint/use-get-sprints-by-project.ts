import { useQuery } from "@tanstack/react-query";
import getSprintsByProject from "@/fetchers/sprint/get-sprints-by-project";

function useGetSprintsByProject(projectId: string) {
  return useQuery({
    enabled: Boolean(projectId),
    queryKey: ["sprints", projectId],
    queryFn: () => getSprintsByProject({ projectId }),
  });
}

export default useGetSprintsByProject;
