import { createFileRoute, redirect } from "@tanstack/react-router";

// Old links or clicks before workspace data loaded can omit the ID.
export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/",
)({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard", replace: true });
  },
});
