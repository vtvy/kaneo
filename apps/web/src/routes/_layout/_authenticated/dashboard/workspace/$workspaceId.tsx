import { createFileRoute, Outlet } from "@tanstack/react-router";
import { WorkspaceArchivedBanner } from "@/components/common/workspace-archived-banner";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { workspaceId } = Route.useParams();

  return (
    <div className="flex h-full w-full min-w-0 flex-col">
      <WorkspaceArchivedBanner workspaceId={workspaceId} />
      <div className="flex min-h-0 w-full flex-1">
        <Outlet />
      </div>
    </div>
  );
}
