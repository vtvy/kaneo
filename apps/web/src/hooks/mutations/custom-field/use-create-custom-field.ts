import { useMutation, useQueryClient } from "@tanstack/react-query";
import createCustomField from "@/fetchers/custom-field/create-custom-field";

function useCreateCustomField(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCustomField,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["custom-fields", projectId],
        }),
        queryClient.invalidateQueries({ queryKey: ["custom-field-values"] }),
      ]),
  });
}

export default useCreateCustomField;
