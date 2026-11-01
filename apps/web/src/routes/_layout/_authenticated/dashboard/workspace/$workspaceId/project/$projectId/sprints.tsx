import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import ProjectLayout from "@/components/common/project-layout";
import SprintsPanel from "@/components/sprint/sprints-panel";
import { Button } from "@/components/ui/button";
import WorkItems from "@/components/work-items";
import useGetProject from "@/hooks/queries/project/use-get-project";
export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/sprints",
)({ component: Page });
function Page() {
  const { projectId, workspaceId } = Route.useParams();
  const { data: project } = useGetProject({ id: projectId, workspaceId });
  const [manage, setManage] = useState(false);
  return (
    <ProjectLayout
      projectId={projectId}
      workspaceId={workspaceId}
      activeView="sprints"
    >
      <div className="flex h-full flex-col">
        <div className="flex gap-2 border-b p-2">
          <Button
            size="sm"
            variant={!manage ? "secondary" : "ghost"}
            onClick={() => setManage(false)}
          >
            Taskboard
          </Button>
          <Button
            size="sm"
            variant={manage ? "secondary" : "ghost"}
            onClick={() => setManage(true)}
          >
            Sprint management
          </Button>
        </div>
        {manage ? (
          <div className="min-h-0 flex-1 overflow-auto">
            <SprintsPanel
              projectId={projectId}
              workspaceId={workspaceId}
              projectSlug={project?.slug}
            />
          </div>
        ) : (
          <WorkItems
            projectId={projectId}
            workspaceId={workspaceId}
            mode="sprint"
          />
        )}
      </div>
    </ProjectLayout>
  );
}
