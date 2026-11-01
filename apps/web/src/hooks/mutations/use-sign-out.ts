import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { getIdToken } from "@/fetchers/oauth/get-id-token";
import { authClient } from "@/lib/auth-client";

function useSignOut(idpLogoutUrl?: string | null) {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async () => {
      // Built (and the id_token read) before the session ends, which is
      // what lets the identity provider identify the session to end.
      const url = idpLogoutUrl ? new URL(idpLogoutUrl) : null;
      if (url) {
        url.searchParams.set(
          "post_logout_redirect_uri",
          `${window.location.origin}/auth/sign-in`,
        );
        try {
          const { idToken } = await getIdToken();
          if (idToken) url.searchParams.set("id_token_hint", idToken);
        } catch {
          // If we can't get the id_token, proceed without it.
        }
      }

      const result = await authClient.signOut();
      if (result.error) {
        throw new Error(result.error.message);
      }
      // Leave for the identity provider without an in-app navigation first,
      // which could cancel the pending page load.
      if (url) {
        window.location.href = url.toString();
      } else {
        await navigate({ to: "/auth/sign-in" });
      }
      return result.data;
    },
  });
}

export default useSignOut;
