import { useQuery } from "@tanstack/react-query";
import type { CustomFieldDefinition } from "@/components/project/custom-fields/types";
import getCustomFieldsByProject from "@/fetchers/custom-field/get-custom-fields-by-project";

function useGetCustomFieldsByProject(projectId: string) {
  return useQuery({
    queryKey: ["custom-fields", projectId],
    // The API types options as unknown; they are always a string list.
    queryFn: async () =>
      (await getCustomFieldsByProject({
        projectId,
      })) as unknown as CustomFieldDefinition[],
    enabled: Boolean(projectId),
  });
}

export default useGetCustomFieldsByProject;
