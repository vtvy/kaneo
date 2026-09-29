import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import ProjectLayout from "@/components/common/project-layout";
import DocumentsView from "@/components/documents/documents-view";
import PageTitle from "@/components/page-title";
import useGetProject from "@/hooks/queries/project/use-get-project";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/documents",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { projectId, workspaceId } = Route.useParams();
  const { data: project } = useGetProject({ id: projectId, workspaceId });

  return (
    <ProjectLayout
      projectId={projectId}
      workspaceId={workspaceId}
      activeView="documents"
    >
      <PageTitle
        title={`${project?.name ?? "Project"} — ${t("documents:nav.title")}`}
        hideAppName
      />
      <DocumentsView projectId={projectId} workspaceId={workspaceId} />
    </ProjectLayout>
  );
}
