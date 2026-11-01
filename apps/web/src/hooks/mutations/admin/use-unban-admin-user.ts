import { useMutation, useQueryClient } from "@tanstack/react-query";
import unbanAdminUser from "@/fetchers/admin/unban-admin-user";

export function useUnbanAdminUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => unbanAdminUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
  });
}

export default useUnbanAdminUser;
