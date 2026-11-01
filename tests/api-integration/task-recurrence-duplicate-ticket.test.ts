import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

async function seedTask(
  projectId: string,
  columnId: string,
  values: Partial<typeof schema.taskTable.$inferInsert> = {},
) {
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId,
      title: "Water the plants",
      priority: "high",
      status: "to-do",
      columnId,
      number: 1,
      position: 1,
      ...values,
    })
    .returning();
  return task;
}

// The next occurrence is created by an event subscriber after the response.
async function waitForTaskNumber(projectId: string, number: number) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const task = await db.query.taskTable.findFirst({
      where: and(
        eq(schema.taskTable.projectId, projectId),
        eq(schema.taskTable.number, number),
      ),
    });
    if (task) return task;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return undefined;
}

async function seedOwnerProject(slug = "kan") {
  const owner = await createWorkspaceMember({ role: "owner" });
  const { project, columns } = await createProjectFixture({
    workspaceId: owner.workspace.id,
    slug,
  });
  return { owner, project, columns };
}

async function addWorkspaceMember(workspaceId: string) {
  const outsider = await createWorkspaceMember();
  await db.insert(schema.workspaceUserTable).values({
    workspaceId,
    userId: outsider.user.id,
    role: "member",
    joinedAt: new Date(),
  });
  return outsider;
}

describe("API integration: recurring tasks", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("creates the next occurrence when a repeating task is completed", async () => {
    const { owner, project, columns } = await seedOwnerProject();
    const task = await seedTask(project.id, columns.todo.id, {
      startDate: new Date("2026-10-05T00:00:00.000Z"),
      dueDate: new Date("2026-10-09T00:00:00.000Z"),
    });

    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    const ruleResponse = await app.request(`/api/task/recurrence/${task.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        recurrence: { frequency: "weekly", interval: 1, timeZone: "UTC" },
      }),
    });
    expect(ruleResponse.status).toBe(200);

    const statusResponse = await app.request(`/api/task/status/${task.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "done" }),
    });
    expect(statusResponse.status).toBe(200);

    const next = await waitForTaskNumber(project.id, 2);
    expect(next).toBeDefined();
    expect(next?.title).toBe("Water the plants");
    expect(next?.status).toBe("to-do");
    expect(next?.dueDate?.toISOString()).toBe("2026-10-16T00:00:00.000Z");
    expect(next?.startDate?.toISOString()).toBe("2026-10-12T00:00:00.000Z");
    expect(next?.recurrence).toMatchObject({ frequency: "weekly" });

    // The completed task handed its rule over, so the other events from the
    // same completion do not start a second series.
    const completed = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, task.id),
    });
    expect(completed?.recurrence).toBeNull();
    expect(await waitForTaskNumber(project.id, 3)).toBeUndefined();
  });

  it("refuses to start a repeat rule on a completed task", async () => {
    const { owner, project, columns } = await seedOwnerProject();
    const task = await seedTask(project.id, columns.done.id, {
      status: "done",
      dueDate: new Date("2026-10-09T00:00:00.000Z"),
    });

    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    const response = await app.request(`/api/task/recurrence/${task.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        recurrence: { frequency: "daily", interval: 1, timeZone: "UTC" },
      }),
    });
    expect(response.status).toBe(409);
  });

  it("forbids setting a repeat rule outside the project", async () => {
    const { owner, project, columns } = await seedOwnerProject();
    const task = await seedTask(project.id, columns.todo.id);
    const outsider = await addWorkspaceMember(owner.workspace.id);

    mockAuthenticatedSession(outsider.user);
    const { app } = createApp();

    const response = await app.request(`/api/task/recurrence/${task.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        recurrence: { frequency: "daily", interval: 1, timeZone: "UTC" },
      }),
    });
    expect(response.status).toBe(403);
  });
});

describe("API integration: duplicate task", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("copies fields and labels into a new task number", async () => {
    const { owner, project, columns } = await seedOwnerProject();
    const task = await seedTask(project.id, columns.todo.id, {
      description: "Every pot on the balcony",
      userId: owner.user.id,
      points: 3,
      dueDate: new Date("2026-10-09T00:00:00.000Z"),
    });
    await db.insert(schema.labelTable).values({
      name: "home",
      color: "green",
      taskId: task.id,
      workspaceId: owner.workspace.id,
    });

    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    const response = await app.request(`/api/task/duplicate/${task.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(200);
    const copy = (await response.json()) as { id: string; number: number };

    expect(copy.id).not.toBe(task.id);
    expect(copy.number).toBe(2);
    const persisted = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, copy.id),
    });
    expect(persisted).toMatchObject({
      projectId: project.id,
      title: task.title,
      description: "Every pot on the balcony",
      priority: "high",
      userId: owner.user.id,
      points: 3,
      status: "to-do",
    });
    expect(persisted?.dueDate?.toISOString()).toBe("2026-10-09T00:00:00.000Z");
    const labels = await db.query.labelTable.findMany({
      where: eq(schema.labelTable.taskId, copy.id),
    });
    expect(labels.map((label) => label.name)).toEqual(["home"]);
  });

  it("forbids duplicating for a workspace member outside the project", async () => {
    const { owner, project, columns } = await seedOwnerProject();
    const task = await seedTask(project.id, columns.todo.id);
    const outsider = await addWorkspaceMember(owner.workspace.id);

    mockAuthenticatedSession(outsider.user);
    const { app } = createApp();

    const response = await app.request(`/api/task/duplicate/${task.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(403);
  });
});

describe("API integration: short task links", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("resolves PROJECT-NUMBER within a workspace slug", async () => {
    const { owner, project, columns } = await seedOwnerProject("kan");
    const task = await seedTask(project.id, columns.todo.id, { number: 12 });

    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    const response = await app.request(
      `/api/task/ticket/KAN-12?workspaceSlug=${owner.workspace.slug}`,
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      id: string;
      projectId: string;
      workspaceId: string;
    };
    expect(body).toMatchObject({
      id: task.id,
      projectId: project.id,
      workspaceId: owner.workspace.id,
    });

    const missing = await app.request(
      `/api/task/ticket/KAN-99?workspaceSlug=${owner.workspace.slug}`,
    );
    expect(missing.status).toBe(404);

    const invalid = await app.request(
      `/api/task/ticket/KAN?workspaceSlug=${owner.workspace.slug}`,
    );
    expect(invalid.status).toBe(400);
  });

  it("returns 403 to a workspace member who is not in the project", async () => {
    const { owner, project, columns } = await seedOwnerProject("kan");
    await seedTask(project.id, columns.todo.id, { number: 12 });
    const outsider = await addWorkspaceMember(owner.workspace.id);

    mockAuthenticatedSession(outsider.user);
    const { app } = createApp();

    const response = await app.request(
      `/api/task/ticket/KAN-12?workspaceSlug=${owner.workspace.slug}`,
    );
    expect(response.status).toBe(403);
  });

  it("returns 403 to a user outside the workspace", async () => {
    const { owner, project, columns } = await seedOwnerProject("kan");
    await seedTask(project.id, columns.todo.id, { number: 12 });
    const stranger = await createWorkspaceMember({ role: "owner" });

    mockAuthenticatedSession(stranger.user);
    const { app } = createApp();

    const response = await app.request(
      `/api/task/ticket/KAN-12?workspaceSlug=${owner.workspace.slug}`,
    );
    expect(response.status).toBe(403);
  });
});
