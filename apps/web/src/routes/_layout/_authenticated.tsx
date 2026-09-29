import { createFileRoute, redirect } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";

// protects all child routes, must be logged in
export const Route = createFileRoute("/_layout/_authenticated")({
  beforeLoad: async ({ location }) => {
    let session = null;
    try {
      const { data } = await authClient.getSession();
      session = data;
    } catch (error) {
      // getSession() rejected (e.g. network error) — treat as unauthenticated
      // instead of letting the rejection bubble up as a blank error screen.
      if (import.meta.env.DEV) console.warn("getSession failed", error);
    }
    if (!session) {
      throw redirect({
        to: "/auth/sign-in",
        search: {
          redirect:
            location.pathname +
            (typeof location.searchStr === "string" ? location.searchStr : ""),
        },
      });
    }
    return { session };
  },
});
