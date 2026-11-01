import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateCustomField, {
  type UpdateCustomFieldRequest,
} from "@/fetchers/custom-field/update-custom-field";

function useUpdateCustomField(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdateCustomFieldRequest;
    }) => updateCustomField(id, data),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["custom-fields", projectId],
        }),
        queryClient.invalidateQueries({ queryKey: ["custom-field-values"] }),
      ]),
  });
}

export default useUpdateCustomField;
