import { createFileRoute, redirect } from "@tanstack/react-router";
import { getPendingInvitations } from "@/fetchers/invitation/get-pending-invitations";
import getWorkspaces from "@/fetchers/workspace/get-workspaces";
import { authClient } from "@/lib/auth-client";
import type Workspace from "@/types/workspace";

export const Route = createFileRoute("/_layout/_authenticated/dashboard/")({
  beforeLoad: async () => {
    const workspaces: Workspace[] = await getWorkspaces();

    if (!workspaces?.length) {
      // Invitations are only a hint for users without a workspace; an
      // unavailable invitations endpoint must not block dashboard entry.
      const invitations = await getPendingInvitations().catch(() => []);
      if (invitations && invitations.length > 0) {
        throw redirect({ to: "/invitations" });
      }
      throw redirect({ to: "/onboarding" });
    }

    const session = await authClient.getSession();
    const activeWorkspaceId = session?.data?.session?.activeOrganizationId;

    if (
      activeWorkspaceId &&
      workspaces.some((ws) => ws.id === activeWorkspaceId)
    ) {
      throw redirect({
        to: "/dashboard/workspace/$workspaceId",
        params: { workspaceId: activeWorkspaceId },
      });
    }

    const firstWorkspace = workspaces[0];

    authClient.organization.setActive({
      organizationId: firstWorkspace.id,
    });

    throw redirect({
      to: "/dashboard/workspace/$workspaceId",
      params: { workspaceId: firstWorkspace.id },
    });
  },
});
