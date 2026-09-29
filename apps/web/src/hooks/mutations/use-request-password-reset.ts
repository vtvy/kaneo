import { useMutation } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";

type RequestPasswordResetInput = {
  email: string;
  redirectTo: string;
};

function useRequestPasswordReset() {
  return useMutation({
    mutationFn: async ({ email, redirectTo }: RequestPasswordResetInput) => {
      const { data, error } = await authClient.requestPasswordReset({
        email,
        redirectTo,
      });

      if (error) {
        throw new Error(error.message || "Failed to send password reset email");
      }

      return data;
    },
  });
}

export default useRequestPasswordReset;
