import { useMutation, useQueryClient } from "@tanstack/react-query";
import setAdminUserRole from "@/fetchers/admin/set-admin-user-role";

export function useSetAdminUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      role,
    }: {
      userId: string;
      role: "admin" | "user";
    }) => setAdminUserRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
  });
}

export default useSetAdminUserRole;
