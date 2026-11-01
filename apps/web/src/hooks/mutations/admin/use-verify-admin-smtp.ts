import { useMutation, useQueryClient } from "@tanstack/react-query";
import verifyAdminSmtp from "@/fetchers/admin/verify-admin-smtp";

export function useVerifyAdminSmtp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: verifyAdminSmtp,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "audit-log"] });
    },
  });
}

export default useVerifyAdminSmtp;
