import { useMutation } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";

type ResetPasswordInput = {
  newPassword: string;
  token: string;
};

function useResetPassword() {
  return useMutation({
    mutationFn: async ({ newPassword, token }: ResetPasswordInput) => {
      const { data, error } = await authClient.resetPassword({
        newPassword,
        token,
      });

      if (error) {
        throw new Error(error.message || "Failed to reset password");
      }

      return data;
    },
  });
}

export default useResetPassword;
