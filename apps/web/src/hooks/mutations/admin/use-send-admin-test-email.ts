import { useMutation, useQueryClient } from "@tanstack/react-query";
import sendAdminTestEmail from "@/fetchers/admin/send-admin-test-email";

export function useSendAdminTestEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: sendAdminTestEmail,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "audit-log"] });
    },
  });
}

export default useSendAdminTestEmail;
