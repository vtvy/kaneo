import { useMutation, useQueryClient } from "@tanstack/react-query";
import revokeAdminUserSessions from "@/fetchers/admin/revoke-admin-user-sessions";

export function useRevokeAdminUserSessions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      sessionId,
    }: {
      userId: string;
      sessionId?: string;
    }) => revokeAdminUserSessions(userId, sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
  });
}

export default useRevokeAdminUserSessions;
