import { useMutation, useQueryClient } from "@tanstack/react-query";
import deleteCustomField from "@/fetchers/custom-field/delete-custom-field";

function useDeleteCustomField(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCustomField,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["custom-fields", projectId],
        }),
        queryClient.invalidateQueries({ queryKey: ["custom-field-values"] }),
      ]),
  });
}

export default useDeleteCustomField;
