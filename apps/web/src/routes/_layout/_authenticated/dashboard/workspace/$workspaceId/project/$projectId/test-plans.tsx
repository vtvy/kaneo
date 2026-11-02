import { createFileRoute } from "@tanstack/react-router";
import ProjectLayout from "@/components/common/project-layout";
import TestPlans from "@/components/test-plans";
export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/test-plans",
)({ component: Page });
function Page() {
  const { projectId, workspaceId } = Route.useParams();
  return (
    <ProjectLayout
      projectId={projectId}
      workspaceId={workspaceId}
      activeView="test-plans"
    >
      <TestPlans
        key={projectId}
        projectId={projectId}
        workspaceId={workspaceId}
      />
    </ProjectLayout>
  );
}
