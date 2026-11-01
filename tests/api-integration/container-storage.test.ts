import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import deleteWorkspace from "../../apps/api/src/admin/controllers/delete-workspace";
import { auth } from "../../apps/api/src/auth";
import db, { schema } from "../../apps/api/src/database";
import deleteProject from "../../apps/api/src/project/controllers/delete-project";
import { storage } from "../../apps/api/src/storage";
import { deleteS3Object } from "../../apps/api/src/storage/s3";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

vi.mock("../../apps/api/src/storage", () => ({
  storage: { delete: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock("../../apps/api/src/storage/s3", () => ({
  deleteS3Object: vi.fn().mockResolvedValue(undefined),
}));

async function seedContainer() {
  const { user, workspace } = await createWorkspaceMember();
  const { project } = await createProjectFixture({ workspaceId: workspace.id });
  const key = `container/${randomUUID()}`;
  await db.insert(schema.documentTable).values({
    projectId: project.id,
    name: "Trashed document",
    source: "server",
    storageKey: `${key}/document`,
    size: 1,
    contentType: "text/plain",
    deletedAt: new Date(),
  });
  await db.insert(schema.assetTable).values({
    workspaceId: workspace.id,
    projectId: project.id,
    objectKey: `${key}/asset`,
    filename: "asset.png",
    mimeType: "image/png",
    size: 1,
  });
  return { user, workspace, project, key };
}

describe("API integration: container storage cleanup", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    vi.mocked(storage.delete).mockClear();
    vi.mocked(deleteS3Object).mockClear();
  });

  it("removes only the deleted project's documents (including trash) and assets", async () => {
    const container = await seedContainer();
    const survivor = await seedContainer();
    await deleteProject(container.project.id, container.workspace.id);
    expect(storage.delete).toHaveBeenCalledExactlyOnceWith(
      `${container.key}/document`,
    );
    expect(deleteS3Object).toHaveBeenCalledExactlyOnceWith(
      `${container.key}/asset`,
    );
    expect(storage.delete).not.toHaveBeenCalledWith(`${survivor.key}/document`);
  });

  it("does not delete files on a failed workspace confirmation, and cleans them after commit", async () => {
    const { user, workspace, key } = await seedContainer();
    const audit = { actorUserId: user.id, ipAddress: null, userAgent: null };
    await expect(
      deleteWorkspace(audit, workspace.id, "wrong name"),
    ).rejects.toThrow();
    expect(storage.delete).not.toHaveBeenCalled();
    expect(deleteS3Object).not.toHaveBeenCalled();
    await deleteWorkspace(audit, workspace.id, workspace.name);
    expect(storage.delete).toHaveBeenCalledExactlyOnceWith(`${key}/document`);
    expect(deleteS3Object).toHaveBeenCalledExactlyOnceWith(`${key}/asset`);
  });

  it("also cleans files when a workspace owner deletes through Better Auth", async () => {
    const { user, workspace, key } = await seedContainer();
    await db
      .update(schema.workspaceUserTable)
      .set({ role: "owner" })
      .where(eq(schema.workspaceUserTable.userId, user.id));
    const token = randomUUID();
    await db.insert(schema.sessionTable).values({
      id: randomUUID(),
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const response = await auth.handler(
      new Request("http://localhost:1337/api/auth/organization/delete", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
          origin: "http://localhost:5173",
        },
        body: JSON.stringify({ organizationId: workspace.id }),
      }),
    );
    expect(response.status).toBe(200);
    expect(storage.delete).toHaveBeenCalledExactlyOnceWith(`${key}/document`);
    expect(deleteS3Object).toHaveBeenCalledExactlyOnceWith(`${key}/asset`);
  });
});
