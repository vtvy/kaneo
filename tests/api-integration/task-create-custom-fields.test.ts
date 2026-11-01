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

async function fixture() {
  const admin = await createWorkspaceMember({ role: "admin" });
  const { project } = await createProjectFixture({
    workspaceId: admin.workspace.id,
  });
  const [stage, tags, flag, note] = await db
    .insert(schema.customFieldDefinitionTable)
    .values([
      {
        projectId: project.id,
        name: "Stage",
        type: "dropdown",
        options: ["Design", "Build", "Legacy"],
        hiddenOptions: ["Legacy"],
        position: 0,
      },
      {
        projectId: project.id,
        name: "Tags",
        type: "multiselect",
        options: ["ui", "api"],
        position: 1,
      },
      {
        projectId: project.id,
        name: "Flag",
        type: "boolean",
        defaultValue: "false",
        position: 2,
      },
      { projectId: project.id, name: "Note", type: "text", position: 3 },
    ])
    .returning();
  const { app } = createApp();
  mockAuthenticatedSession(admin.user);
  return { admin, project, app, stage, tags, flag, note };
}

function createTask(
  app: Awaited<ReturnType<typeof fixture>>["app"],
  projectId: string,
  customFields?: { fieldId: string; value: string }[],
) {
  return app.request(`/api/task/${projectId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: "With fields",
      description: "",
      priority: "no-priority",
      status: "to-do",
      ...(customFields ? { customFields } : {}),
    }),
  });
}

async function valuesOf(taskId: string) {
  const rows = await db
    .select()
    .from(schema.customFieldValueTable)
    .where(eq(schema.customFieldValueTable.taskId, taskId));
  return Object.fromEntries(rows.map((row) => [row.fieldId, row.value]));
}

async function taskCount(projectId: string) {
  const rows = await db
    .select({ id: schema.taskTable.id })
    .from(schema.taskTable)
    .where(eq(schema.taskTable.projectId, projectId));
  return rows.length;
}

describe("create task with custom field values", () => {
  it("stores valid values and keeps defaults for fields not sent", async () => {
    const { app, project, stage, tags, flag, note } = await fixture();
    const response = await createTask(app, project.id, [
      { fieldId: stage.id, value: "Build" },
      { fieldId: tags.id, value: JSON.stringify(["ui", "api"]) },
      { fieldId: note.id, value: "  hello  " },
    ]);
    expect(response.status, await response.clone().text()).toBe(200);
    const task = (await response.json()) as { id: string };
    expect(await valuesOf(task.id)).toEqual({
      [stage.id]: "Build",
      [tags.id]: JSON.stringify(["ui", "api"]),
      [note.id]: "hello",
      [flag.id]: "false",
    });
  });

  it("rejects a field from another project", async () => {
    const { app, admin, project } = await fixture();
    const { project: other } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    const [foreign] = await db
      .insert(schema.customFieldDefinitionTable)
      .values({ projectId: other.id, name: "Foreign", type: "text" })
      .returning();
    const response = await createTask(app, project.id, [
      { fieldId: foreign.id, value: "x" },
    ]);
    expect(response.status).toBe(400);
    expect(await taskCount(project.id)).toBe(0);
  });

  it("rejects an option the field does not have", async () => {
    const { app, project, stage, tags } = await fixture();
    expect(
      (
        await createTask(app, project.id, [
          { fieldId: stage.id, value: "Nope" },
        ])
      ).status,
    ).toBe(400);
    expect(
      (
        await createTask(app, project.id, [
          { fieldId: tags.id, value: JSON.stringify(["ui", "nope"]) },
        ])
      ).status,
    ).toBe(400);
    expect(await taskCount(project.id)).toBe(0);
  });

  it("rejects a hidden option", async () => {
    const { app, project, stage } = await fixture();
    const response = await createTask(app, project.id, [
      { fieldId: stage.id, value: "Legacy" },
    ]);
    expect(response.status).toBe(400);
    expect(await response.text()).toContain("Hidden options");
    expect(await taskCount(project.id)).toBe(0);
  });

  it("requires required fields without a default once values are sent", async () => {
    const { app, project, stage } = await fixture();
    await db
      .update(schema.customFieldDefinitionTable)
      .set({ required: true })
      .where(eq(schema.customFieldDefinitionTable.id, stage.id));

    expect((await createTask(app, project.id, [])).status).toBe(400);
    expect(
      (await createTask(app, project.id, [{ fieldId: stage.id, value: "" }]))
        .status,
    ).toBe(400);
    expect(
      (
        await createTask(app, project.id, [
          { fieldId: stage.id, value: "Design" },
        ])
      ).status,
    ).toBe(200);
    // Clients that send no values keep creating tasks as before.
    expect((await createTask(app, project.id)).status).toBe(200);
  });

  it("lets a project Member set values on create but not a Viewer", async () => {
    const { app, project, stage } = await fixture();
    const body = [{ fieldId: stage.id, value: "Build" }];

    const member = await createWorkspaceMember();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: project.workspaceId,
      userId: member.user.id,
      role: "member",
      joinedAt: new Date(),
    });
    await joinProject(project.id, member.user.id, "Member");
    mockAuthenticatedSession(member.user);
    expect((await createTask(app, project.id, body)).status).toBe(200);

    const viewer = await createWorkspaceMember();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: project.workspaceId,
      userId: viewer.user.id,
      role: "member",
      joinedAt: new Date(),
    });
    await joinProject(project.id, viewer.user.id, "Viewer");
    mockAuthenticatedSession(viewer.user);
    expect((await createTask(app, project.id, body)).status).toBe(403);
    expect(await taskCount(project.id)).toBe(1);
  });
});

describe("project custom field values", () => {
  it("returns every task's values in one request for project readers only", async () => {
    const { app, project, stage } = await fixture();
    const first = (await (
      await createTask(app, project.id, [{ fieldId: stage.id, value: "Build" }])
    ).json()) as { id: string };
    const second = (await (
      await createTask(app, project.id, [
        { fieldId: stage.id, value: "Design" },
      ])
    ).json()) as { id: string };

    const response = await app.request(
      `/api/custom-field/project/${project.id}/values`,
    );
    expect(response.status).toBe(200);
    const rows = (await response.json()) as {
      taskId: string;
      fieldId: string;
      value: string;
    }[];
    const stageValues = rows
      .filter((row) => row.fieldId === stage.id)
      .map((row) => [row.taskId, row.value]);
    expect(stageValues).toEqual(
      expect.arrayContaining([
        [first.id, "Build"],
        [second.id, "Design"],
      ]),
    );

    const outsider = await createWorkspaceMember({ role: "admin" });
    mockAuthenticatedSession(outsider.user);
    expect(
      (await app.request(`/api/custom-field/project/${project.id}/values`))
        .status,
    ).toBe(403);
  });
});
