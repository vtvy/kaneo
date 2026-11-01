import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
  joinProject,
} from "./helpers/fixtures";

beforeEach(resetTestDatabase);

async function fixture(role = "admin") {
  const member = await createWorkspaceMember({ role });
  const { project, columns } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      title: "Private task",
      number: 1,
      status: "to-do",
      columnId: columns.todo.id,
    })
    .returning();
  const [field] = await db
    .insert(schema.customFieldDefinitionTable)
    .values({
      projectId: project.id,
      name: "Private field",
      type: "text",
      required: false,
      defaultValue: "private-default",
      position: 0,
    })
    .returning();
  await db
    .insert(schema.customFieldValueTable)
    .values({ taskId: task.id, fieldId: field.id, value: "private-value" });
  const { app } = createApp();
  return {
    member,
    project,
    task,
    field,
    app,
    paths: [
      `/api/custom-field/project/${project.id}`,
      `/api/custom-field/project/${project.id}/values`,
      `/api/custom-field/task/${task.id}`,
      `/api/custom-field/project/${project.id}/filter-values`,
    ],
  };
}

// A workspace member who is not in the project yet.
async function addWorkspaceMember(workspaceId: string) {
  const other = await createWorkspaceMember();
  await db.insert(schema.workspaceUserTable).values({
    workspaceId,
    userId: other.user.id,
    role: "member",
    joinedAt: new Date(),
  });
  return other.user;
}

function json(
  app: Awaited<ReturnType<typeof fixture>>["app"],
  method: string,
  path: string,
  body: unknown,
) {
  return app.request(path, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("custom field project permissions", () => {
  it("hides fields and values from workspace members outside the project", async () => {
    const { app, paths, project, task, field } = await fixture();
    const outsider = await addWorkspaceMember(project.workspaceId);
    mockAuthenticatedSession(outsider);

    for (const path of paths) {
      const response = await app.request(path);
      expect(response.status, path).toBe(403);
      const body = await response.text();
      expect(body).not.toContain("private-value");
      expect(body).not.toContain("Private field");
    }

    const set = await json(app, "PUT", "/api/custom-field/value", {
      taskId: task.id,
      fieldId: field.id,
      value: "changed",
    });
    expect(set.status).toBe(403);
  });

  it("lets a project Viewer read values but not set them", async () => {
    const { app, paths, project, task, field } = await fixture();
    const viewer = await addWorkspaceMember(project.workspaceId);
    await joinProject(project.id, viewer.id, "Viewer");
    mockAuthenticatedSession(viewer);

    for (const [index, path] of paths.entries()) {
      const response = await app.request(path);
      expect(response.status, path).toBe(200);
      expect(await response.text()).toContain(
        index === 0 ? "private-default" : "private-value",
      );
    }

    const set = await json(app, "PUT", "/api/custom-field/value", {
      taskId: task.id,
      fieldId: field.id,
      value: "changed",
    });
    expect(set.status).toBe(403);
    const [row] = await db
      .select({ value: schema.customFieldValueTable.value })
      .from(schema.customFieldValueTable)
      .where(eq(schema.customFieldValueTable.taskId, task.id));
    expect(row?.value).toBe("private-value");
  });

  it("lets a project Member set values but not define fields", async () => {
    const { app, project, task, field } = await fixture();
    const member = await addWorkspaceMember(project.workspaceId);
    await joinProject(project.id, member.id, "Member");
    mockAuthenticatedSession(member);

    const set = await json(app, "PUT", "/api/custom-field/value", {
      taskId: task.id,
      fieldId: field.id,
      value: "changed",
    });
    expect(set.status).toBe(200);

    const create = await json(app, "POST", "/api/custom-field", {
      projectId: project.id,
      name: "Another",
      type: "text",
    });
    expect(create.status).toBe(403);
    const update = await json(app, "PUT", `/api/custom-field/${field.id}`, {
      name: "Renamed",
    });
    expect(update.status).toBe(403);
    const reorder = await json(
      app,
      "PUT",
      `/api/custom-field/reorder/${project.id}`,
      { fields: [{ id: field.id, position: 3 }] },
    );
    expect(reorder.status).toBe(403);
    const remove = await app.request(`/api/custom-field/${field.id}`, {
      method: "DELETE",
    });
    expect(remove.status).toBe(403);
  });

  it("lets a project Owner define fields", async () => {
    const { app, project, field } = await fixture();
    const owner = await addWorkspaceMember(project.workspaceId);
    await joinProject(project.id, owner.id, "Owner");
    mockAuthenticatedSession(owner);

    const update = await json(app, "PUT", `/api/custom-field/${field.id}`, {
      name: "Renamed",
    });
    expect(update.status, await update.text()).toBe(200);
  });

  it("does not expose fields to users of other workspaces", async () => {
    const { app, paths, field } = await fixture();
    const outsider = await createWorkspaceMember({ role: "admin" });
    mockAuthenticatedSession(outsider.user);
    for (const path of paths) {
      const response = await app.request(path);
      expect(response.status, path).toBe(403);
    }
    const update = await json(app, "PUT", `/api/custom-field/${field.id}`, {
      name: "Renamed",
    });
    expect(update.status).toBe(403);
  });
});

describe("date defaults", () => {
  it.each([
    "2026-02-30",
    "2025-02-29",
    "2026-13-01",
    "2026-00-01",
    "2026-01-00",
    "2026-02-30T12:00:00Z",
    "September 19, 2026",
  ])("rejects invalid default %s without definition or backfill writes", async (defaultValue) => {
    const { member, project, app } = await fixture();
    mockAuthenticatedSession(member.user);
    const response = await json(app, "POST", "/api/custom-field", {
      projectId: project.id,
      name: "Deadline",
      type: "date",
      required: true,
      defaultValue,
    });
    expect(response.status).toBe(400);
    expect(
      await db.select().from(schema.customFieldDefinitionTable),
    ).toHaveLength(1);
    expect(await db.select().from(schema.customFieldValueTable)).toHaveLength(
      1,
    );
  });

  it.each([
    "2028-02-29",
    "2028-02-29T12:00:00Z",
    " 2028-02-29 ",
  ])("accepts %s and uses it for existing and newly created tasks", async (defaultValue) => {
    const { member, project, app } = await fixture();
    mockAuthenticatedSession(member.user);
    const response = await json(app, "POST", "/api/custom-field", {
      projectId: project.id,
      name: "Deadline",
      type: "date",
      required: true,
      defaultValue,
    });
    expect(response.status).toBe(200);
    const field = await response.json();
    const created = await json(app, "POST", `/api/task/${project.id}`, {
      title: "New task",
      description: "",
      priority: "low",
      status: "to-do",
    });
    expect(created.status, await created.text()).toBe(200);
    const values = await db
      .select()
      .from(schema.customFieldValueTable)
      .where(eq(schema.customFieldValueTable.fieldId, field.id));
    expect(values).toHaveLength(2);
    expect(values.every((value) => value.value === defaultValue.trim())).toBe(
      true,
    );
  });
});
