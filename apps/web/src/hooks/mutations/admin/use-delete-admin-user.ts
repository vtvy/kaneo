import { useMutation, useQueryClient } from "@tanstack/react-query";
import deleteAdminUser from "@/fetchers/admin/delete-admin-user";

export function useDeleteAdminUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => deleteAdminUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
  });
}

export default useDeleteAdminUser;
