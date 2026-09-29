import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import BacklogTable from "@/components/backlog-table";
import ProjectLayout from "@/components/common/project-layout";
import PageTitle from "@/components/page-title";
import CreateTaskModal from "@/components/shared/modals/create-task-modal";
import { Button } from "@/components/ui/button";
import { shortcuts } from "@/constants/shortcuts";
import useGetProject from "@/hooks/queries/project/use-get-project";
import { useRegisterShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useProjectPermission } from "@/hooks/use-project-permission";
import { useUserPreferencesStore } from "@/store/user-preferences";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/backlog",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { projectId, workspaceId } = Route.useParams();
  const navigate = useNavigate();
  const { data: project } = useGetProject({ id: projectId, workspaceId });
  const { can: canProject } = useProjectPermission(projectId);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  const { setViewMode } = useUserPreferencesStore();

  useRegisterShortcuts({
    sequentialShortcuts: {
      [shortcuts.view.prefix]: {
        [shortcuts.view.board]: () => {
          setViewMode("board");
          navigate({
            to: "/dashboard/workspace/$workspaceId/project/$projectId/board",
            params: { workspaceId, projectId },
          });
        },
        [shortcuts.view.list]: () => {
          setViewMode("list");
          navigate({
            to: "/dashboard/workspace/$workspaceId/project/$projectId/board",
            params: { workspaceId, projectId },
          });
        },
        [shortcuts.view.gantt]: () => {
          navigate({
            to: "/dashboard/workspace/$workspaceId/project/$projectId/gantt",
            params: { workspaceId, projectId },
          });
        },
        [shortcuts.view.backlog]: () => {},
      },
    },
  });

  const backlogHeaderActions = canProject("item", "create") ? (
    <Button
      size="sm"
      className="h-7.5"
      onClick={() => setIsTaskModalOpen(true)}
    >
      <Plus className="mr-1 h-3.5 w-3.5" />
      {t("backlog:newTask")}
    </Button>
  ) : null;

  return (
    <ProjectLayout
      projectId={projectId}
      workspaceId={workspaceId}
      activeView="backlog"
      headerActions={backlogHeaderActions}
    >
      <PageTitle
        title={t("tasks:backlog.pageTitle", { name: project?.name })}
      />
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
        <div className="h-full min-h-0 flex-1 overflow-hidden bg-card">
          <BacklogTable
            projectId={projectId}
            workspaceId={workspaceId}
            projectSlug={project?.slug}
          />
        </div>

        <CreateTaskModal
          open={isTaskModalOpen}
          projectId={projectId}
          onClose={() => setIsTaskModalOpen(false)}
        />
      </div>
    </ProjectLayout>
  );
}
