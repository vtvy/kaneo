import { generateLink } from "@/lib/generate-link";

// Short links look like /acme/task/KAN-12. Without a workspace slug, project
// slug or task number, fall back to the full task URL.
export function taskLink({
  workspaceId,
  workspaceSlug,
  projectId,
  projectSlug,
  taskId,
  taskNumber,
}: {
  workspaceId: string;
  workspaceSlug?: string | null;
  projectId: string;
  projectSlug?: string | null;
  taskId: string;
  taskNumber?: number | null;
}) {
  if (workspaceSlug && projectSlug && taskNumber) {
    const ticketId = `${projectSlug.toUpperCase()}-${taskNumber}`;
    return generateLink(
      `/${encodeURIComponent(workspaceSlug)}/task/${encodeURIComponent(ticketId)}`,
    );
  }
  return generateLink(
    `/dashboard/workspace/${workspaceId}/project/${projectId}/task/${taskId}`,
  );
}
