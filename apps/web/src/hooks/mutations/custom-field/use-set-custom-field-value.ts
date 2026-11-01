import { useMutation, useQueryClient } from "@tanstack/react-query";
import setCustomFieldValue from "@/fetchers/custom-field/set-custom-field-value";

function useSetCustomFieldValue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: setCustomFieldValue,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["custom-field-project-values"],
      });
      return queryClient.invalidateQueries({
        queryKey: ["custom-field-values", variables.taskId],
      });
    },
  });
}

export default useSetCustomFieldValue;
