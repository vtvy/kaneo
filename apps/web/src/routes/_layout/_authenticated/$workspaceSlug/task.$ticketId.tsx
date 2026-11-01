import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import useGetTaskByTicketId from "@/hooks/queries/task/use-get-task-by-ticket-id";

export const Route = createFileRoute(
  "/_layout/_authenticated/$workspaceSlug/task/$ticketId",
)({
  component: ShortTaskLinkRedirect,
});

// Resolves a short link like /acme/task/KAN-12 to the full task page.
function ShortTaskLinkRedirect() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { workspaceSlug, ticketId } = Route.useParams();
  const { data: task, isError } = useGetTaskByTicketId(workspaceSlug, ticketId);

  useEffect(() => {
    if (!task) return;
    void navigate({
      to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
      params: {
        workspaceId: task.workspaceId,
        projectId: task.projectId,
        taskId: task.id,
      },
      replace: true,
    });
  }, [navigate, task]);

  return (
    <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">
      {isError
        ? t("tasks:shortLink.resolveError")
        : t("tasks:shortLink.resolving")}
    </div>
  );
}
