import { useLocation, useNavigate } from "@tanstack/react-router";
import {
  CalendarDays,
  Files,
  Repeat,
  SquareKanban,
  SquircleDashed,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import MobileProjectNav from "@/components/common/header/mobile-project-nav";
import ProjectCrumbSelect from "@/components/common/header/project-crumb-select";
import WorkspaceCrumbSelect from "@/components/common/header/workspace-crumb-select";
import Layout from "@/components/common/layout";
import NotificationDropdown from "@/components/notification/notification-dropdown";
import CreateProjectModal from "@/components/shared/modals/create-project-modal";
import { Button } from "@/components/ui/button";
import { KbdSequence } from "@/components/ui/kbd";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { shortcuts } from "@/constants/shortcuts";
import useGetProject from "@/hooks/queries/project/use-get-project";
import useGetWorkspaces from "@/hooks/queries/workspace/use-get-workspaces";
import { useProjectWebSocket } from "@/hooks/use-project-websocket";
import { useTrackRecentVisits } from "@/hooks/use-track-recent-visits";
import { cn } from "@/lib/cn";
import { clearLastProjectForWorkspace } from "@/store/recent-visits";

type ProjectLayoutProps = {
  projectId: string;
  workspaceId: string;
  headerActions?: ReactNode;
  children: ReactNode;
  showViewSwitcher?: boolean;
  activeView?: "backlog" | "board" | "gantt" | "sprints" | "documents";
};

export default function ProjectLayout({
  projectId,
  workspaceId,
  headerActions,
  children,
  showViewSwitcher = true,
  activeView,
}: ProjectLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { data: project, isError: isProjectError } = useGetProject({
    id: projectId,
    workspaceId,
  });
  const { data: workspaces } = useGetWorkspaces();
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] =
    useState(false);

  useProjectWebSocket(projectId);
  useTrackRecentVisits(workspaceId, projectId, Boolean(project));

  // Stale/deleted project URLs used to leave the board on a permanent error
  // state and re-poison "last project" memory. Bounce to a safe destination.
  useEffect(() => {
    if (!isProjectError) return;

    clearLastProjectForWorkspace(workspaceId);

    const workspaceStillExists = workspaces?.some(
      (workspace) => workspace.id === workspaceId,
    );

    if (workspaceStillExists) {
      navigate({
        to: "/dashboard/workspace/$workspaceId",
        params: { workspaceId },
        replace: true,
      });
      return;
    }

    navigate({ to: "/dashboard", replace: true });
  }, [isProjectError, navigate, workspaceId, workspaces]);

  const resolvedView =
    activeView ??
    (location.pathname.includes("/backlog")
      ? "backlog"
      : location.pathname.includes("/gantt")
        ? "gantt"
        : location.pathname.includes("/sprints")
          ? "sprints"
          : location.pathname.includes("/documents")
            ? "documents"
            : "board");

  const handleNavigateToBacklog = () => {
    navigate({
      to: "/dashboard/workspace/$workspaceId/project/$projectId/backlog",
      params: { workspaceId, projectId },
    });
  };

  const handleNavigateToBoard = () => {
    navigate({
      to: "/dashboard/workspace/$workspaceId/project/$projectId/board",
      params: { workspaceId, projectId },
    });
  };

  const handleNavigateToGantt = () => {
    navigate({
      to: "/dashboard/workspace/$workspaceId/project/$projectId/gantt",
      params: { workspaceId, projectId },
    });
  };

  const handleNavigateToSprints = () => {
    navigate({
      to: "/dashboard/workspace/$workspaceId/project/$projectId/sprints",
      params: { workspaceId, projectId },
    });
  };

  const handleNavigateToDocuments = () => {
    navigate({
      to: "/dashboard/workspace/$workspaceId/project/$projectId/documents",
      params: { workspaceId, projectId },
    });
  };

  const handleProjectSwitch = (nextProjectId: string) => {
    navigate({
      to:
        resolvedView === "backlog"
          ? "/dashboard/workspace/$workspaceId/project/$projectId/backlog"
          : resolvedView === "gantt"
            ? "/dashboard/workspace/$workspaceId/project/$projectId/gantt"
            : resolvedView === "sprints"
              ? "/dashboard/workspace/$workspaceId/project/$projectId/sprints"
              : resolvedView === "documents"
                ? "/dashboard/workspace/$workspaceId/project/$projectId/documents"
                : "/dashboard/workspace/$workspaceId/project/$projectId/board",
      params: {
        workspaceId,
        projectId: nextProjectId,
      },
    });
  };

  return (
    <Layout>
      <Layout.Header className="h-11 border-border/80 px-2">
        <div className="flex w-full items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarTrigger className="-ml-1 h-7 w-7 cursor-pointer text-foreground/85 hover:text-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="flex items-center gap-2 text-[10px]">
                    {t("common:a11y.toggleSidebar")}
                    <KbdSequence
                      keys={[
                        shortcuts.sidebar.prefix,
                        shortcuts.sidebar.toggle,
                      ]}
                    />
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <div className="h-4 w-px shrink-0 bg-border/80" />

            <div className="hidden min-w-0 items-center gap-1 md:flex">
              <WorkspaceCrumbSelect />
              <span className="text-foreground/30 text-xs">/</span>
              <ProjectCrumbSelect
                workspaceId={workspaceId}
                projectId={projectId}
                projectName={project?.name}
                onSelectProject={handleProjectSwitch}
                onAddProject={() => setIsCreateProjectModalOpen(true)}
              />
            </div>

            <div className="md:hidden">
              <MobileProjectNav
                workspaceId={workspaceId}
                projectId={projectId}
                activeView={resolvedView}
                onSelectBacklog={handleNavigateToBacklog}
                onSelectBoard={handleNavigateToBoard}
                onSelectGantt={handleNavigateToGantt}
                onSelectSprints={handleNavigateToSprints}
                onSelectDocuments={handleNavigateToDocuments}
                onSelectProject={handleProjectSwitch}
                onAddProject={() => setIsCreateProjectModalOpen(true)}
              />
            </div>

            {showViewSwitcher && (
              <div className="hidden h-8 items-center gap-0.5 rounded-lg border border-border/80 bg-background p-0.5 sm:inline-flex">
                <Button
                  variant={resolvedView === "backlog" ? "secondary" : "ghost"}
                  size="xs"
                  onClick={handleNavigateToBacklog}
                  className={cn(
                    "h-6 gap-1.5 rounded-md px-2 text-xs",
                    resolvedView !== "backlog" && "text-muted-foreground",
                  )}
                >
                  <SquircleDashed className="size-3.5" />
                  Backlog
                </Button>
                <Button
                  variant={resolvedView === "board" ? "secondary" : "ghost"}
                  size="xs"
                  onClick={handleNavigateToBoard}
                  className={cn(
                    "h-6 gap-1.5 rounded-md px-2 text-xs",
                    resolvedView !== "board" && "text-muted-foreground",
                  )}
                >
                  <SquareKanban className="size-3.5" />
                  Tasks
                </Button>
                <Button
                  variant={resolvedView === "gantt" ? "secondary" : "ghost"}
                  size="xs"
                  onClick={handleNavigateToGantt}
                  className={cn(
                    "h-6 gap-1.5 rounded-md px-2 text-xs",
                    resolvedView !== "gantt" && "text-muted-foreground",
                  )}
                >
                  <CalendarDays className="size-3.5" />
                  Gantt
                </Button>
                <Button
                  variant={resolvedView === "sprints" ? "secondary" : "ghost"}
                  size="xs"
                  onClick={handleNavigateToSprints}
                  className={cn(
                    "h-6 gap-1.5 rounded-md px-2 text-xs",
                    resolvedView !== "sprints" && "text-muted-foreground",
                  )}
                >
                  <Repeat className="size-3.5" />
                  Sprints
                </Button>
                <Button
                  variant={resolvedView === "documents" ? "secondary" : "ghost"}
                  size="xs"
                  onClick={handleNavigateToDocuments}
                  className={cn(
                    "h-6 gap-1.5 rounded-md px-2 text-xs",
                    resolvedView !== "documents" && "text-muted-foreground",
                  )}
                >
                  <Files className="size-3.5" />
                  {t("documents:nav.title")}
                </Button>
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <NotificationDropdown />
            {headerActions}
          </div>
        </div>
      </Layout.Header>

      <Layout.Content>{children}</Layout.Content>

      <CreateProjectModal
        open={isCreateProjectModalOpen}
        onClose={() => setIsCreateProjectModalOpen(false)}
      />
    </Layout>
  );
}
