import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const state = vi.hoisted(() => ({
  engine: null as PGlite | null,
  actor: "tester",
}));
vi.mock("../../../apps/api/src/database", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const schema = await import("../../../apps/api/src/database/schema");
  const engine = new PGlite();
  state.engine = engine;
  return { default: drizzle(engine, { schema }), schema };
});

import db, { schema } from "../../../apps/api/src/database";
import {
  testResultTable,
  testRunTable,
} from "../../../apps/api/src/database/test-plan-schema";
import moveTask from "../../../apps/api/src/task/controllers/move-task";
import router from "../../../apps/api/src/test-plan";
import {
  summarizeResults,
  validateResult,
} from "../../../apps/api/src/test-plan/model";
import { TestPlanService } from "../../../apps/api/src/test-plan/service";

const service = new TestPlanService();
const caseInput = {
  title: "Transfer funds",
  preconditions: "Signed in",
  steps: [{ action: "Confirm transfer", expected: "Transfer succeeds" }],
  requirementId: null,
  state: "ready",
};
const app = new Hono<{
  Variables: { userId: string; user: { role: string } };
}>();
app.use("*", async (c, next) => {
  c.set("userId", state.actor);
  c.set("user", { role: "user" });
  await next();
});
app.route("/test-plans", router);
const request = (path: string, method = "GET", body?: unknown) =>
  app.request(`/test-plans/${path}`, {
    method,
    ...(body === undefined
      ? {}
      : {
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
let migratedGrants: {
  resource: string;
  action: string;
  project_role_id: string;
}[] = [];
const baseTables = [
  "workspace",
  "user",
  "workspace_member",
  "project",
  "sprint",
  "task",
  "project_role",
  "project_role_permission",
  "project_member",
  "project_member_role",
];
beforeAll(async () => {
  const engine = state.engine;
  if (!engine) throw new Error("Embedded PostgreSQL unavailable");
  const snapshot = JSON.parse(
    readFileSync(resolve("drizzle/meta/0053_snapshot.json"), "utf8"),
  ) as {
    tables: Record<
      string,
      {
        columns: Record<
          string,
          {
            name: string;
            type: string;
            primaryKey: boolean;
            notNull: boolean;
            default?: unknown;
          }
        >;
        uniqueConstraints: Record<string, { name: string; columns: string[] }>;
      }
    >;
  };
  for (const name of baseTables) {
    const table = snapshot.tables[`public.${name}`];
    if (!table) throw new Error(`Missing schema ${name}`);
    const columns = Object.values(table.columns).map(
      (column) =>
        `"${column.name}" ${column.type}${column.primaryKey ? " PRIMARY KEY" : ""}${column.notNull ? " NOT NULL" : ""}${column.default !== undefined ? ` DEFAULT ${column.default}` : ""}`,
    );
    for (const unique of Object.values(table.uniqueConstraints))
      columns.push(
        `CONSTRAINT "${unique.name}" UNIQUE (${unique.columns.map((name) => `"${name}"`).join(",")})`,
      );
    await engine.exec(`CREATE TABLE "${name}" (${columns.join(",")});`);
  }
  await engine.exec(
    "INSERT INTO project_role(id,project_id,name) VALUES ('read-role','p','Viewer'),('write-role','p','Member'); INSERT INTO project_role_permission(id,project_role_id,resource,action) VALUES ('r1','read-role','item','read'),('w1','write-role','item','read'),('w2','write-role','item','create'),('w3','write-role','item','update'),('w4','write-role','item','transition'),('w5','write-role','backlog','manage');",
  );
  await engine.exec(
    readFileSync(resolve("drizzle/0054_manual_test_plans.sql"), "utf8"),
  );
  migratedGrants = (
    await engine.query<{
      resource: string;
      action: string;
      project_role_id: string;
    }>(
      "SELECT resource,action,project_role_id FROM project_role_permission WHERE resource='test'",
    )
  ).rows;
}, 30000);
beforeEach(async () => {
  if (!state.engine) throw new Error("No test database");
  await state.engine.exec(
    `TRUNCATE ${baseTables.map((name) => `"${name}"`).join(",")}, test_plan, test_suite, test_case, test_suite_case, test_run, test_result CASCADE;`,
  );
  state.actor = "tester";
  await db
    .insert(schema.workspaceTable)
    .values({ id: "w", name: "Workspace", slug: "w", createdAt: new Date() });
  await db.insert(schema.userTable).values([
    {
      id: "tester",
      name: "Tester",
      email: "tester@example.test",
      role: "user",
    },
    {
      id: "viewer",
      name: "Viewer",
      email: "viewer@example.test",
      role: "user",
    },
  ]);
  await db.insert(schema.workspaceUserTable).values([
    {
      id: "m1",
      workspaceId: "w",
      userId: "tester",
      role: "owner",
      joinedAt: new Date(),
    },
    {
      id: "m2",
      workspaceId: "w",
      userId: "viewer",
      role: "viewer",
      joinedAt: new Date(),
    },
  ]);
  await db.insert(schema.projectTable).values([
    { id: "p", workspaceId: "w", name: "Project", slug: "p" },
    { id: "other", workspaceId: "w", name: "Other", slug: "other" },
  ]);
  await db
    .insert(schema.projectRoleTable)
    .values({ id: "viewer-role", projectId: "p", name: "Viewer" });
  await db
    .insert(schema.projectRolePermissionTable)
    .values({ projectRoleId: "viewer-role", resource: "test", action: "read" });
  await db
    .insert(schema.projectMemberTable)
    .values({ id: "viewer-member", projectId: "p", userId: "viewer" });
  await db
    .insert(schema.projectMemberRoleTable)
    .values({ projectMemberId: "viewer-member", projectRoleId: "viewer-role" });
});
afterAll(async () => {
  await state.engine?.close();
});

async function fixture() {
  const plan = await service.savePlan("p", {
    title: "Release 1",
    description: "",
    sprintId: null,
    release: "1.0",
    state: "active",
  });
  if (!plan) throw new Error("No plan");
  const suite = await service.saveSuite("p", plan.id, "Payments");
  const testCase = await service.saveCase("p", caseInput);
  if (!suite || !testCase) throw new Error("No test assets");
  await service.attach("p", suite.id, testCase.id);
  const input = {
    title: "Manual run",
    suiteId: suite.id,
    testerId: "tester",
    environment: "staging",
    build: "commit-a",
    clientKey: "request-0001",
  };
  const run = await service.start("p", plan.id, input, "tester");
  const detail = await service.detail("p", run.id);
  const result = detail.results[0];
  if (!result) throw new Error("No result");
  return { plan, suite, testCase, input, run, result };
}
describe("manual Test Plans on embedded PostgreSQL", () => {
  it("backfills viewer read-only and writer test capabilities without granting by role name alone", () => {
    expect(
      migratedGrants
        .filter((row) => row.project_role_id === "read-role")
        .map((row) => row.action),
    ).toEqual(["read"]);
    expect(
      migratedGrants
        .filter((row) => row.project_role_id === "write-role")
        .map((row) => row.action)
        .sort(),
    ).toEqual(["design", "execute", "manage", "read"]);
  });
  it("deduplicates reusable cases across suites and repeated start requests", async () => {
    const { plan, testCase, input, run } = await fixture();
    const secondSuite = await service.saveSuite("p", plan.id, "Regression");
    if (!secondSuite) throw new Error("No suite");
    await service.attach("p", secondSuite.id, testCase.id);
    const another = await service.start(
      "p",
      plan.id,
      { ...input, suiteId: null, clientKey: "request-0002" },
      "tester",
    );
    expect((await service.detail("p", another.id)).results).toHaveLength(1);
    expect((await service.start("p", plan.id, input, "tester")).id).toBe(
      run.id,
    );
    expect(await db.select().from(testRunTable)).toHaveLength(2);
  });
  it("pins snapshot revision and detects stale case edits", async () => {
    const { testCase, run } = await fixture();
    await service.saveCase(
      "p",
      {
        ...caseInput,
        title: "Updated transfer",
        steps: [{ action: "New action", expected: "New result" }],
      },
      testCase.id,
      1,
    );
    await expect(
      service.saveCase("p", caseInput, testCase.id, 1),
    ).rejects.toMatchObject({ status: 409 });
    const detail = await service.detail("p", run.id);
    expect(detail.results[0]?.snapshot.title).toBe("Transfer funds");
    expect(detail.results[0]?.snapshot.revision).toBe(1);
  });
  it("saves step results, freezes closed runs and retains failed attempts after retest", async () => {
    const { run, result, plan, input } = await fixture();
    await service.saveResult(
      "p",
      run.id,
      result.id,
      {
        version: 1,
        outcome: "failed",
        steps: [{ outcome: "failed", actual: "500" }],
        actual: "Server error",
        evidence: ["https://example.test/screenshot.png"],
        bugId: null,
      },
      "tester",
      false,
    );
    await service.transition("p", run.id, "completed", 1, "tester", false);
    await expect(
      service.saveResult(
        "p",
        run.id,
        result.id,
        {
          version: 2,
          outcome: "passed",
          steps: [{ outcome: "passed", actual: "" }],
          actual: "",
          evidence: [],
          bugId: null,
        },
        "tester",
        false,
      ),
    ).rejects.toMatchObject({ status: 409 });
    const retest = await service.start(
      "p",
      plan.id,
      { ...input, clientKey: "retest-001", caseIds: [result.snapshot.caseId] },
      "tester",
    );
    expect((await service.detail("p", retest.id)).results[0]?.outcome).toBe(
      "not_run",
    );
    expect((await service.detail("p", run.id)).results[0]?.outcome).toBe(
      "failed",
    );
  });
  it("rejects false Passed, mismatched steps, stale results and premature completion", async () => {
    const { run, result } = await fixture();
    const input = {
      version: 1,
      outcome: "passed" as const,
      steps: [{ outcome: "not_run" as const, actual: "" }],
      actual: "",
      evidence: [],
      bugId: null,
    };
    await expect(
      service.saveResult("p", run.id, result.id, input, "tester", false),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.transition("p", run.id, "completed", 1, "tester", false),
    ).rejects.toMatchObject({ status: 400 });
    await service.saveResult(
      "p",
      run.id,
      result.id,
      { ...input, outcome: "blocked", actual: "Environment down" },
      "tester",
      false,
    );
    await expect(
      service.saveResult("p", run.id, result.id, input, "tester", false),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("supports pause/resume and rejects unassigned result writes", async () => {
    const { run, result } = await fixture();
    const input = {
      version: 1,
      outcome: "not_run" as const,
      steps: result.steps,
      actual: "",
      evidence: [],
      bugId: null,
    };
    await expect(
      service.saveResult("p", run.id, result.id, input, "viewer", false),
    ).rejects.toMatchObject({ status: 403 });
    await service.transition("p", run.id, "paused", 1, "tester", false);
    await expect(
      service.saveResult("p", run.id, result.id, input, "tester", false),
    ).rejects.toMatchObject({ status: 409 });
    await service.transition("p", run.id, "in_progress", 2, "tester", false);
    expect(
      (await service.saveResult("p", run.id, result.id, input, "tester", false))
        ?.version,
    ).toBe(2);
  });
  it("isolates plans, suites, cases, runs and bug links by project", async () => {
    const { plan, suite, testCase, run, result } = await fixture();
    await expect(service.plan("other", plan.id)).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      service.attach("other", suite.id, testCase.id),
    ).rejects.toMatchObject({ status: 404 });
    await expect(service.detail("other", run.id)).rejects.toMatchObject({
      status: 404,
    });
    await db.insert(schema.taskTable).values({
      id: "foreign-bug",
      projectId: "other",
      title: "Secret bug",
      type: "bug",
    });
    await expect(
      service.saveResult(
        "p",
        run.id,
        result.id,
        {
          version: 1,
          outcome: "not_run",
          steps: result.steps,
          actual: "",
          evidence: [],
          bugId: "foreign-bug",
        },
        "tester",
        false,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect((await service.overview("other")).cases).toHaveLength(0);
  });
  it("enforces read-only roles and rejects unsafe evidence through actual Hono routes", async () => {
    const { run, result } = await fixture();
    state.actor = "viewer";
    expect((await request("p")).status).toBe(200);
    expect((await request("p/cases", "POST", caseInput)).status).toBe(403);
    expect(
      (
        await request(`p/runs/${run.id}/results/${result.id}`, "PUT", {
          version: 1,
          outcome: "not_run",
          steps: result.steps,
          actual: "",
          evidence: [],
          bugId: null,
        })
      ).status,
    ).toBe(403);
    state.actor = "tester";
    expect(
      (
        await request(`p/runs/${run.id}/results/${result.id}`, "PUT", {
          version: 1,
          outcome: "not_run",
          steps: result.steps,
          actual: "",
          evidence: ["javascript:alert(1)"],
          bugId: null,
        })
      ).status,
    ).toBe(400);
  });
  it("reports verdict pass rate separately from unexecuted cases", () => {
    const summary = summarizeResults([
      { outcome: "passed" },
      { outcome: "passed" },
      { outcome: "failed" },
      { outcome: "not_run" },
      { outcome: "blocked" },
      { outcome: "not_applicable" },
    ]);
    expect(summary.total).toBe(6);
    expect(summary.passRate).toBeCloseTo(2 / 3);
    expect(summary.executed).toBe(4);
    expect(validateResult("passed", [], 1)).toMatch(/every/);
  });
  it("does not let a result ID from another run overwrite its snapshot", async () => {
    const { plan, input, run, result } = await fixture();
    const other = await service.start(
      "p",
      plan.id,
      { ...input, clientKey: "other-request" },
      "tester",
    );
    await expect(
      service.saveResult(
        "p",
        other.id,
        result.id,
        {
          version: 1,
          outcome: "not_run",
          steps: result.steps,
          actual: "",
          evidence: [],
          bugId: null,
        },
        "tester",
        false,
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(
      (
        await db
          .select()
          .from(testResultTable)
          .where(eq(testResultTable.runId, run.id))
      )[0]?.version,
    ).toBe(1);
  });
  it("rejects archived plans, retired case selections and assignment by non-managers", async () => {
    const { plan, testCase, input } = await fixture();
    await service.saveCase(
      "p",
      { ...caseInput, state: "retired" },
      testCase.id,
      1,
    );
    await expect(
      service.start(
        "p",
        plan.id,
        { ...input, clientKey: "retired-case", caseIds: [testCase.id] },
        "tester",
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.start(
        "p",
        plan.id,
        { ...input, clientKey: "assign-other" },
        "viewer",
      ),
    ).rejects.toMatchObject({ status: 403 });
    await service.savePlan(
      "p",
      {
        title: plan.title,
        description: "",
        release: "",
        sprintId: null,
        state: "archived",
      },
      plan.id,
    );
    await expect(
      service.start(
        "p",
        plan.id,
        { ...input, clientKey: "archived-plan" },
        "tester",
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("keeps linked requirements in their project instead of breaking Test Plans references", async () => {
    await db.insert(schema.taskTable).values({
      id: "requirement",
      projectId: "p",
      title: "Payments",
      type: "backlog_item",
    });
    await service.saveCase("p", { ...caseInput, requirementId: "requirement" });
    await expect(
      moveTask({
        taskId: "requirement",
        destinationProjectId: "other",
        currentUserId: "tester",
      }),
    ).rejects.toMatchObject({ status: 400 });
    const [item] = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, "requirement"));
    expect(item?.projectId).toBe("p");
  });
});
