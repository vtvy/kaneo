import { useMutation, useQueryClient } from "@tanstack/react-query";
import createAdminUser, {
  type CreateAdminUserRequest,
} from "@/fetchers/admin/create-admin-user";

export function useCreateAdminUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (json: CreateAdminUserRequest) => createAdminUser(json),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
  });
}

export default useCreateAdminUser;
