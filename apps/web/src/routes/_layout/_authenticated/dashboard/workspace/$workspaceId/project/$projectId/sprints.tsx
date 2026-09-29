import { createFileRoute } from "@tanstack/react-router";
import ProjectLayout from "@/components/common/project-layout";
import PageTitle from "@/components/page-title";
import SprintsPanel from "@/components/sprint/sprints-panel";
import useGetProject from "@/hooks/queries/project/use-get-project";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/sprints",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { projectId, workspaceId } = Route.useParams();
  const { data: project } = useGetProject({ id: projectId, workspaceId });

  return (
    <ProjectLayout projectId={projectId} workspaceId={workspaceId}>
      <PageTitle
        title={`${project?.name ?? "Project"} — Sprints`}
        hideAppName
      />
      <div className="h-full overflow-auto bg-background">
        <SprintsPanel
          projectId={projectId}
          workspaceId={workspaceId}
          projectSlug={project?.slug}
        />
      </div>
    </ProjectLayout>
  );
}
