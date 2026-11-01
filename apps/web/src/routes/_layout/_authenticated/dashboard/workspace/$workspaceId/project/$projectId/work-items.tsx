import { createFileRoute } from "@tanstack/react-router";
import ProjectLayout from "@/components/common/project-layout";
import WorkItems from "@/components/work-items";
export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/work-items",
)({ component: Page });
function Page() {
  const { projectId, workspaceId } = Route.useParams();
  return (
    <ProjectLayout
      projectId={projectId}
      workspaceId={workspaceId}
      activeView="work-items"
    >
      <WorkItems projectId={projectId} workspaceId={workspaceId} mode="items" />
    </ProjectLayout>
  );
}
