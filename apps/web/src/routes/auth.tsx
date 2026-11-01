import { createFileRoute, redirect } from "@tanstack/react-router";
import { SessionConnectionError } from "@/components/auth/session-connection-error";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { getRouteSession } from "@/lib/get-route-session";

export const Route = createFileRoute("/auth")({
  beforeLoad: async () => {
    const session = await getRouteSession();
    if (session) {
      throw redirect({
        to: "/dashboard",
      });
    }
    return { session };
  },
  pendingComponent: LoadingSkeleton,
  errorComponent: SessionConnectionError,
});
