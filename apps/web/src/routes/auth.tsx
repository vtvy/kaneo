import { createFileRoute, redirect } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/auth")({
  beforeLoad: async () => {
    let session = null;
    try {
      const { data } = await authClient.getSession();
      session = data;
    } catch (error) {
      // getSession() rejected — treat as unauthenticated so the auth pages
      // still render instead of surfacing an unhandled rejection.
      if (import.meta.env.DEV) console.warn("getSession failed", error);
    }
    if (session) {
      throw redirect({
        to: "/dashboard",
      });
    }
    return { session };
  },
});
