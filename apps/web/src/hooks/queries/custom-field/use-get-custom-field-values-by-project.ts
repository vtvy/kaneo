import { useQuery } from "@tanstack/react-query";
import getCustomFieldValuesByProject from "@/fetchers/custom-field/get-custom-field-values-by-project";

// One request for every task's values in a project (backlog columns/filters).
function useGetCustomFieldValuesByProject(projectId: string, enabled = true) {
  return useQuery({
    queryKey: ["custom-field-project-values", projectId],
    queryFn: () => getCustomFieldValuesByProject({ projectId }),
    enabled: enabled && Boolean(projectId),
  });
}

export default useGetCustomFieldValuesByProject;
