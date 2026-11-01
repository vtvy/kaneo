import { createFileRoute } from "@tanstack/react-router";
import ProjectLayout from "@/components/common/project-layout";
import WorkItems from "@/components/work-items";
export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/backlog",
)({ component: Page });
function Page() {
  const { projectId, workspaceId } = Route.useParams();
  return (
    <ProjectLayout
      projectId={projectId}
      workspaceId={workspaceId}
      activeView="backlog"
    >
      <WorkItems projectId={projectId} workspaceId={workspaceId} mode="tree" />
    </ProjectLayout>
  );
}
