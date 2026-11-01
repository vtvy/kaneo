/** Workspace data can still be loading outside workspace-scoped routes. */
export function getWorkspaceDestination(workspaceId?: string | null) {
  return workspaceId
    ? {
        to: "/dashboard/workspace/$workspaceId" as const,
        params: { workspaceId },
      }
    : { to: "/dashboard" as const };
}
