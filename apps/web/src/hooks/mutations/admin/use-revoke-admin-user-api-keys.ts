import { useMutation, useQueryClient } from "@tanstack/react-query";
import revokeAdminUserApiKeys from "@/fetchers/admin/revoke-admin-user-api-keys";

export function useRevokeAdminUserApiKeys() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, keyId }: { userId: string; keyId?: string }) =>
      revokeAdminUserApiKeys(userId, keyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
  });
}

export default useRevokeAdminUserApiKeys;
