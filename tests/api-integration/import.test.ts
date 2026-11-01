import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

const PLANKA_URL = "https://planka.example.com";
const API_KEY = "planka-secret-api-key-123";

const source = vi.hoisted(() => ({
  calls: [] as { url: string; headers: Headers; redirect?: string }[],
  routes: new Map<string, unknown>(),
}));

// Outbound requests to the import source go through publicFetch; answer them
// from an in-memory PLANKA instead of the network.
vi.mock("../../apps/api/src/utils/public-fetch", () => ({
  publicFetch: async (url: string, init: RequestInit = {}) => {
    source.calls.push({
      url,
      headers: new Headers(init.headers),
      redirect: init.redirect,
    });
    const path = url.slice("https://planka.example.com".length);
    if (!source.routes.has(path)) {
      return new Response(JSON.stringify({ code: "E_NOT_FOUND" }), {
        status: 404,
      });
    }
    return new Response(JSON.stringify(source.routes.get(path)), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },
}));

function seedPlanka(memberEmail: string) {
  source.calls = [];
  source.routes = new Map<string, unknown>([
    [
      "/api/projects",
      {
        items: [{ id: "p1", name: "Marketing" }],
        included: {
          boards: [{ id: "b1", projectId: "p1", name: "Content", position: 1 }],
        },
      },
    ],
    [
      "/api/boards/b1",
      {
        item: { id: "b1", projectId: "p1", name: "Content", position: 1 },
        included: {
          lists: [
            {
              id: "l_todo",
              boardId: "b1",
              name: "To Do",
              type: "active",
              position: 1,
              color: null,
            },
            {
              id: "l_done",
              boardId: "b1",
              name: "Done",
              type: "closed",
              position: 2,
              color: null,
            },
          ],
          cards: [
            {
              id: "c1",
              boardId: "b1",
              listId: "l_todo",
              name: "Write launch post",
              description: "Draft it",
              position: 1,
              dueDate: null,
              isDueCompleted: null,
              isClosed: false,
              commentsTotal: 1,
            },
            {
              id: "c2",
              boardId: "b1",
              listId: "l_done",
              name: "Pick a date",
              description: null,
              position: 2,
              dueDate: null,
              isDueCompleted: null,
              isClosed: false,
              commentsTotal: 0,
            },
          ],
          labels: [
            {
              id: "lb1",
              boardId: "b1",
              name: "Bug",
              color: "berry-red",
              position: 1,
            },
          ],
          cardLabels: [{ cardId: "c1", labelId: "lb1" }],
          cardMemberships: [
            { cardId: "c1", userId: "u_member" },
            { cardId: "c2", userId: "u_stranger" },
          ],
          users: [
            {
              id: "u_member",
              email: memberEmail,
              name: "Member",
              username: "member",
            },
            {
              id: "u_stranger",
              email: "stranger@elsewhere.test",
              name: "Stranger",
              username: "stranger",
            },
          ],
        },
      },
    ],
    [
      "/api/cards/c1/comments",
      {
        items: [
          {
            id: "cm1",
            cardId: "c1",
            userId: "u_stranger",
            text: "Looks good",
            createdAt: "2026-01-02T08:00:00.000Z",
          },
        ],
        included: { users: [] },
      },
    ],
    ["/api/cards/c1/comments?beforeId=cm1", { items: [] }],
  ]);
}

async function seedWorkspace() {
  const admin = await createWorkspaceMember({ role: "admin" });
  const workspaceId = admin.workspace.id;
  const member = await createWorkspaceMember();
  await db.insert(schema.workspaceUserTable).values({
    workspaceId,
    userId: member.user.id,
    role: "member",
    joinedAt: new Date(),
  });
  return { admin, member, workspaceId };
}

const connection = { source: "planka", url: PLANKA_URL, apiKey: API_KEY };

function post(
  app: ReturnType<typeof createApp>["app"],
  path: string,
  body: unknown,
) {
  return app.request(`/api/import${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function waitForRun(runId: string) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const [run] = await db
      .select()
      .from(schema.importRunTable)
      .where(eq(schema.importRunTable.id, runId));
    if (run && run.status !== "running") return run;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("The import did not finish");
}

describe("API integration: import from other tools", () => {
  const previousAllow = process.env.KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS;

  beforeEach(async () => {
    await resetTestDatabase();
    // Skip the DNS preflight; publicFetch itself is replaced above.
    process.env.KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS = "true";
  });

  afterEach(() => {
    process.env.KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS = previousAllow;
  });

  it("imports a PLANKA board with columns, labels, assignees and comments", async () => {
    const { admin, member, workspaceId } = await seedWorkspace();
    seedPlanka(member.user.email);
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const listed = await post(app, "/projects", { workspaceId, connection });
    expect(listed.status).toBe(200);
    expect(await listed.json()).toEqual({
      projects: [{ id: "b1", name: "Marketing", detail: "Marketing" }],
    });

    const started = await post(app, "/runs", {
      workspaceId,
      connection,
      projectIds: ["b1"],
    });
    expect(started.status).toBe(202);
    const { run } = (await started.json()) as { run: { id: string } };

    const finished = await waitForRun(run.id);
    expect(finished.status).toBe("completed");
    const [imported] = finished.projects;
    expect(imported?.status).toBe("completed");
    expect(imported?.counts).toMatchObject({
      columns: 2,
      tasks: 2,
      labels: 1,
      comments: 1,
      assignees: 1,
    });
    expect(imported?.warnings.join(" ")).toContain("Stranger");

    const projectId = imported?.projectId as string;
    const [project] = await db
      .select()
      .from(schema.projectTable)
      .where(eq(schema.projectTable.id, projectId));
    expect(project?.workspaceId).toBe(workspaceId);

    const columns = await db
      .select()
      .from(schema.columnTable)
      .where(eq(schema.columnTable.projectId, projectId));
    expect(
      columns.map((column) => [column.name, column.isFinal]).sort(),
    ).toEqual([
      ["Done", true],
      ["To Do", false],
    ]);

    const tasks = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.projectId, projectId));
    const launch = tasks.find((task) => task.title === "Write launch post");
    const pick = tasks.find((task) => task.title === "Pick a date");
    expect(launch?.userId).toBe(member.user.id);
    expect(launch?.status).toBe("to-do");
    expect(launch?.description).toContain("Draft it");
    expect(pick?.userId).toBeNull();
    expect(pick?.status).toBe("done");
    expect(new Set(tasks.map((task) => task.number)).size).toBe(2);

    const labels = await db
      .select()
      .from(schema.labelTable)
      .where(eq(schema.labelTable.workspaceId, workspaceId));
    expect(labels.find((label) => label.taskId === launch?.id)).toMatchObject({
      name: "Bug",
      color: "pink",
    });

    const [comment] = await db
      .select()
      .from(schema.activityTable)
      .where(
        and(
          eq(schema.activityTable.taskId, launch?.id as string),
          eq(schema.activityTable.type, "comment"),
        ),
      );
    expect(comment).toMatchObject({
      content: "Looks good",
      externalSource: "planka",
    });

    // The importer owns the new project.
    const owners = await db
      .select({ userId: schema.projectMemberTable.userId })
      .from(schema.projectMemberTable)
      .innerJoin(
        schema.projectMemberRoleTable,
        eq(
          schema.projectMemberRoleTable.projectMemberId,
          schema.projectMemberTable.id,
        ),
      )
      .innerJoin(
        schema.projectRoleTable,
        eq(
          schema.projectRoleTable.id,
          schema.projectMemberRoleTable.projectRoleId,
        ),
      )
      .where(
        and(
          eq(schema.projectMemberTable.projectId, projectId),
          eq(schema.projectRoleTable.name, "Owner"),
        ),
      );
    expect(owners).toEqual([{ userId: admin.user.id }]);

    // Credentials are sent to the source, never followed through redirects,
    // and never stored.
    expect(source.calls.length).toBeGreaterThan(0);
    for (const call of source.calls) {
      expect(call.headers.get("x-api-key")).toBe(API_KEY);
      expect(call.redirect).toBe("manual");
    }
    expect(JSON.stringify(finished)).not.toContain(API_KEY);

    const runs = await app.request(`/api/import/runs/${workspaceId}`);
    expect(runs.status).toBe(200);
    const history = await runs.text();
    expect(history).toContain(run.id);
    expect(history).not.toContain(API_KEY);
  });

  it("refuses a plain workspace member", async () => {
    const { member, workspaceId } = await seedWorkspace();
    seedPlanka(member.user.email);
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const listed = await post(app, "/projects", { workspaceId, connection });
    expect(listed.status).toBe(403);
    const started = await post(app, "/runs", {
      workspaceId,
      connection,
      projectIds: ["b1"],
    });
    expect(started.status).toBe(403);
    expect(source.calls).toHaveLength(0);
    expect(await db.select().from(schema.importRunTable)).toHaveLength(0);
  });

  it("answers a bad body without echoing the credentials", async () => {
    const { admin, workspaceId } = await seedWorkspace();
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const response = await post(app, "/runs", {
      workspaceId,
      connection,
      projectIds: [],
    });
    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain(API_KEY);
  });
});
