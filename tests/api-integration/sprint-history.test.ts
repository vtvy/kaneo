import { asc, eq } from "drizzle-orm";
import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { seedProjectRoles } from "../../apps/api/src/project-rbac/seed-default-project-roles";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

async function seedSprint(projectId: string, name: string) {
  const [sprint] = await db
    .insert(schema.sprintTable)
    .values({ projectId, name })
    .returning();
  return sprint;
}

async function membershipsOf(taskId: string) {
  return db
    .select({
      sprintId: schema.taskSprintTable.sprintId,
      removedAt: schema.taskSprintTable.removedAt,
    })
    .from(schema.taskSprintTable)
    .where(eq(schema.taskSprintTable.taskId, taskId))
    .orderBy(asc(schema.taskSprintTable.addedAt));
}

async function seedProjectWithSprints() {
  const owner = await createWorkspaceMember({ role: "owner" });
  const { project, columns } = await createProjectFixture({
    workspaceId: owner.workspace.id,
    slug: "hist",
  });
  const sprintOne = await seedSprint(project.id, "Sprint 1");
  const sprintTwo = await seedSprint(project.id, "Sprint 2");
  return { owner, project, columns, sprintOne, sprintTwo };
}

describe("API integration: sprint history", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("records each sprint a task enters and leaves", async () => {
    const { owner, project, sprintOne, sprintTwo } =
      await seedProjectWithSprints();
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    const createResponse = await app.request(`/api/task/${project.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Login page",
        description: "",
        priority: "low",
        status: "to-do",
        sprintId: sprintOne.id,
      }),
    });
    expect(createResponse.status).toBe(200);
    const task = (await createResponse.json()) as { id: string };

    expect(await membershipsOf(task.id)).toEqual([
      { sprintId: sprintOne.id, removedAt: null },
    ]);

    const assignResponse = await app.request(
      `/api/sprint/${sprintTwo.id}/task`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ taskId: task.id }),
      },
    );
    expect(assignResponse.status).toBe(200);

    let rows = await membershipsOf(task.id);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.sprintId).toBe(sprintOne.id);
    expect(rows[0]?.removedAt).toBeInstanceOf(Date);
    expect(rows[1]).toEqual({ sprintId: sprintTwo.id, removedAt: null });

    const removeResponse = await app.request(
      `/api/sprint/${sprintTwo.id}/task`,
      {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ taskId: task.id }),
      },
    );
    expect(removeResponse.status).toBe(200);

    rows = await membershipsOf(task.id);
    expect(rows.every((row) => row.removedAt instanceof Date)).toBe(true);

    // Re-entering a sprint reopens its row rather than adding a duplicate.
    await app.request(`/api/sprint/${sprintOne.id}/task`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ taskId: task.id }),
    });
    rows = await membershipsOf(task.id);
    expect(rows).toHaveLength(2);
    expect(
      rows.find((row) => row.sprintId === sprintOne.id)?.removedAt,
    ).toBeNull();

    const historyResponse = await app.request(
      `/api/sprint/task/${task.id}/history`,
    );
    expect(historyResponse.status).toBe(200);
    const history = (await historyResponse.json()) as {
      sprintId: string;
      name: string;
      removedAt: string | null;
    }[];
    expect(history.map((entry) => entry.name).sort()).toEqual([
      "Sprint 1",
      "Sprint 2",
    ]);
    expect(
      history.find((entry) => entry.sprintId === sprintOne.id)?.removedAt,
    ).toBeNull();
  });

  it("closes carried-over tasks when a sprint completes", async () => {
    const { owner, project, columns, sprintOne, sprintTwo } =
      await seedProjectWithSprints();
    const [unfinished, finished] = await db
      .insert(schema.taskTable)
      .values([
        {
          projectId: project.id,
          title: "Unfinished",
          priority: "low",
          status: "to-do",
          columnId: columns.todo.id,
          sprintId: sprintOne.id,
          number: 1,
          position: 1,
        },
        {
          projectId: project.id,
          title: "Finished",
          priority: "low",
          status: "done",
          columnId: columns.done.id,
          sprintId: sprintOne.id,
          number: 2,
          position: 2,
        },
      ])
      .returning();
    await db.insert(schema.taskSprintTable).values([
      { taskId: unfinished.id, sprintId: sprintOne.id },
      { taskId: finished.id, sprintId: sprintOne.id },
    ]);

    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    const response = await app.request(`/api/sprint/${sprintOne.id}/complete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetSprintId: sprintTwo.id }),
    });
    expect(response.status).toBe(200);

    const carried = await membershipsOf(unfinished.id);
    expect(carried).toHaveLength(2);
    expect(carried[0]?.removedAt).toBeInstanceOf(Date);
    expect(carried[1]).toEqual({ sprintId: sprintTwo.id, removedAt: null });

    expect(await membershipsOf(finished.id)).toEqual([
      { sprintId: sprintOne.id, removedAt: null },
    ]);
  });

  it("exports one sheet per sprint as an Excel workbook", async () => {
    const { owner, project, columns, sprintOne, sprintTwo } =
      await seedProjectWithSprints();
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title: "Moved task",
        priority: "high",
        status: "in-progress",
        columnId: columns.inProgress.id,
        sprintId: sprintTwo.id,
        points: 3,
        number: 7,
        position: 1,
      })
      .returning();
    await db.insert(schema.taskSprintTable).values([
      {
        taskId: task.id,
        sprintId: sprintOne.id,
        addedAt: new Date("2026-01-01T00:00:00.000Z"),
        removedAt: new Date("2026-01-15T00:00:00.000Z"),
      },
      {
        taskId: task.id,
        sprintId: sprintTwo.id,
        addedAt: new Date("2026-01-15T00:00:00.000Z"),
      },
    ]);

    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    const response = await app.request(
      `/api/sprint/project/${project.id}/export`,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain(
      "spreadsheetml.sheet",
    );
    expect(response.headers.get("content-disposition")).toContain(
      'filename="hist-sprints.xlsx"',
    );

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await response.arrayBuffer());
    expect(workbook.worksheets.map((sheet) => sheet.name).sort()).toEqual([
      "Sprint 1",
      "Sprint 2",
    ]);
    const firstSheet = workbook.getWorksheet("Sprint 1");
    expect(firstSheet?.getRow(2).getCell(1).value).toBe("hist-7");
    expect(firstSheet?.getRow(2).getCell(9).value).toBe("Moved to Sprint 2");
  });

  it("hides history and export from workspace members outside the project", async () => {
    const { owner, project, columns } = await seedProjectWithSprints();
    await seedProjectRoles(db, project.id);
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title: "Private task",
        priority: "low",
        status: "to-do",
        columnId: columns.todo.id,
        number: 1,
        position: 1,
      })
      .returning();

    const outsider = await createWorkspaceMember();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: owner.workspace.id,
      userId: outsider.user.id,
      role: "member",
      joinedAt: new Date(),
    });

    mockAuthenticatedSession(outsider.user);
    const { app } = createApp();

    for (const path of [
      `/api/sprint/task/${task.id}/history`,
      `/api/sprint/project/${project.id}/export`,
    ]) {
      const response = await app.request(path);
      expect(response.status, path).toBe(403);
    }
  });
});
