import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../apps/api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

describe("CLI profile and workspace discovery", () => {
  beforeEach(resetTestDatabase);

  it("requires authentication for both discovery endpoints", async () => {
    mockAnonymousSession();
    const { app } = createApp();
    expect((await app.request("/api/user/me")).status).toBe(401);
    expect((await app.request("/api/workspace")).status).toBe(401);
  });

  it("returns the caller profile and only their workspace memberships", async () => {
    const member = await createWorkspaceMember();
    const outsider = await createWorkspaceMember();
    mockAuthenticatedSession(member.user);
    const { app } = createApp();
    const profile = await (await app.request("/api/user/me")).json();
    expect(profile).toEqual({
      id: member.user.id,
      name: member.user.name,
      email: member.user.email,
      image: member.user.image,
      role: member.user.role,
    });
    const workspaces = await (await app.request("/api/workspace")).json();
    expect(workspaces).toHaveLength(1);
    expect(workspaces[0]).toMatchObject({
      id: member.workspace.id,
      role: "member",
    });
    expect(JSON.stringify(workspaces)).not.toContain(outsider.workspace.id);
  });
});
