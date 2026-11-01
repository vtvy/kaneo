import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateAdminSettings, {
  type UpdateAdminSettingsRequest,
} from "@/fetchers/admin/update-admin-settings";

export function useUpdateAdminSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (json: UpdateAdminSettingsRequest) => updateAdminSettings(json),
    onSuccess: (settings) => {
      queryClient.setQueryData(["admin", "settings"], settings);
      queryClient.invalidateQueries({ queryKey: ["admin", "audit-log"] });
      queryClient.invalidateQueries({ queryKey: ["config"] });
    },
  });
}

export default useUpdateAdminSettings;
