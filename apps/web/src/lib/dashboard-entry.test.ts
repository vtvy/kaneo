import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-client", () => ({
  authClient: { getSession: vi.fn(), organization: { setActive: vi.fn() } },
}));
vi.mock("@/fetchers/workspace/get-workspaces", () => ({ default: vi.fn() }));
vi.mock("@/fetchers/invitation/get-pending-invitations", () => ({
  getPendingInvitations: vi.fn(),
}));

import { getPendingInvitations } from "@/fetchers/invitation/get-pending-invitations";
import getWorkspaces from "@/fetchers/workspace/get-workspaces";
import { authClient } from "@/lib/auth-client";
import { Route } from "@/routes/_layout/_authenticated/dashboard/index";

const load = () => Route.options.beforeLoad?.({} as never);

describe("dashboard entry", () => {
  beforeEach(() => {
    vi.mocked(getPendingInvitations).mockReset();
    vi.mocked(getWorkspaces).mockResolvedValue([]);
  });

  it("does not block entry if the invitations endpoint is unavailable", async () => {
    vi.mocked(getPendingInvitations).mockRejectedValue(
      new Error("Unavailable"),
    );
    await expect(load()).rejects.toMatchObject({
      options: { to: "/onboarding" },
    });
  });

  it("offers pending invitations to users without a workspace", async () => {
    vi.mocked(getPendingInvitations).mockResolvedValue([
      { id: "invite-1" },
    ] as never);
    await expect(load()).rejects.toMatchObject({
      options: { to: "/invitations" },
    });
  });

  it("enters an existing workspace without checking invitations", async () => {
    vi.mocked(getWorkspaces).mockResolvedValue([
      { id: "workspace-1" },
    ] as never);
    vi.mocked(authClient.getSession).mockResolvedValue({
      data: { session: { activeOrganizationId: "workspace-1" } },
    } as never);
    await expect(load()).rejects.toMatchObject({
      options: {
        to: "/dashboard/workspace/$workspaceId",
        params: { workspaceId: "workspace-1" },
      },
    });
    expect(getPendingInvitations).not.toHaveBeenCalled();
  });
});
