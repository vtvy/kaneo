import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

describe("work item views share a guarded hierarchy", () => {
  beforeEach(resetTestDatabase);
  async function setup() {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();
    const post = (type: string, parentId: string | null = null) =>
      app.request(`/api/work-items/${project.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: type, type, parentId }),
      });
    const patch = (id: string, body: object) =>
      app.request(`/api/work-items/${project.id}/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    return { owner, project, app, post, patch };
  }
  it("creates the hierarchy, shares types with existing task APIs and assigns a subtree atomically", async () => {
    const { project, app, post, patch } = await setup();
    const epic = await (await post("epic")).json();
    const feature = await (await post("feature", epic.id)).json();
    const backlog = await (await post("backlog_item", feature.id)).json();
    const task = await (await post("task", backlog.id)).json();
    expect(task.parentId).toBe(backlog.id);
    const [sprint] = await db
      .insert(schema.sprintTable)
      .values({ projectId: project.id, name: "Sprint 1" })
      .returning();
    if (!sprint) throw new Error("Sprint fixture missing");
    expect((await patch(backlog.id, { sprintId: sprint.id })).status).toBe(200);
    const [child] = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, task.id));
    expect(child?.sprintId).toBe(sprint.id);
    const detail = await app.request(`/api/task/${task.id}`);
    expect(detail.status).toBe(200);
    expect((await detail.json()).type).toBe("task");
    expect((await patch(backlog.id, { type: "feature" })).status).toBe(400);
    expect((await post("task", epic.id)).status).toBe(400);
  });
  it("rejects cross-project parents and updates without revealing foreign items", async () => {
    const { owner, project, app, post, patch } = await setup();
    const { project: other } = await createProjectFixture({
      workspaceId: owner.workspace.id,
      slug: "other",
    });
    const [foreign] = await db
      .insert(schema.taskTable)
      .values({
        projectId: other.id,
        title: "Foreign backlog",
        type: "backlog_item",
      })
      .returning();
    if (!foreign) throw new Error("Foreign task fixture missing");
    expect((await post("task", foreign.id)).status).toBe(400);
    expect((await patch(foreign.id, { type: "epic" })).status).toBe(404);
    const response = await app.request(`/api/work-items/${project.id}`);
    expect(
      (await response.json()).some(
        (item: { id: string }) => item.id === foreign.id,
      ),
    ).toBe(false);
  });
  it("keeps old tasks as standalone Tasks and rolls back invalid sprint assignment", async () => {
    const { project, post, patch } = await setup();
    const [legacy] = await db
      .insert(schema.taskTable)
      .values({ projectId: project.id, title: "Old task" })
      .returning();
    expect(legacy?.type).toBe("task");
    expect(legacy?.parentId).toBeNull();
    const backlog = await (await post("backlog_item")).json();
    const task = await (await post("task", backlog.id)).json();
    expect(
      (await patch(backlog.id, { sprintId: "missing-sprint" })).status,
    ).toBe(400);
    const [unchanged] = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, task.id));
    expect(unchanged?.sprintId).toBeNull();
  });
});
