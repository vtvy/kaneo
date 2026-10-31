import { useMutation, useQueryClient } from "@tanstack/react-query";
import reorderCustomFields from "@/fetchers/custom-field/reorder-custom-fields";

function useReorderCustomFields(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (fields: Array<{ id: string; position: number }>) =>
      reorderCustomFields(projectId, fields),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["custom-fields", projectId],
      }),
  });
}

export default useReorderCustomFields;
