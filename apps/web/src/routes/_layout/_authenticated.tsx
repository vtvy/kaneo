import { createFileRoute, redirect } from "@tanstack/react-router";
import { SessionConnectionError } from "@/components/auth/session-connection-error";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { getRouteSession } from "@/lib/get-route-session";

// protects all child routes, must be logged in
export const Route = createFileRoute("/_layout/_authenticated")({
  beforeLoad: async ({ location }) => {
    // Only a confirmed missing session redirects to sign-in. Network errors and
    // 5xx responses (e.g. during a deploy) surface as a retryable error instead.
    const session = await getRouteSession();
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
  pendingComponent: LoadingSkeleton,
  errorComponent: SessionConnectionError,
});
