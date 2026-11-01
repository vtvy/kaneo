import { useMutation, useQueryClient } from "@tanstack/react-query";
import banAdminUser from "@/fetchers/admin/ban-admin-user";

export function useBanAdminUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason?: string }) =>
      banAdminUser(userId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
  });
}

export default useBanAdminUser;
