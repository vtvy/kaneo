import { and, desc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import {
  projectTable,
  sprintTable,
  taskTable,
  userTable,
  workspaceUserTable,
} from "../database/schema";
import {
  testCaseTable as cases,
  testSuiteCaseTable as links,
  testPlanTable as plans,
  testResultTable as results,
  testRunTable as runs,
  testSuiteTable as suites,
} from "../database/test-plan-schema";
import { canInProject } from "../project-rbac/can-in-project";
import {
  type Outcome,
  type StepResult,
  summarizeResults,
  type TestStep,
  validateResult,
} from "./model";

type PlanInput = {
  title: string;
  description: string;
  sprintId: string | null;
  release: string;
  state: string;
};
type CaseInput = {
  title: string;
  preconditions: string;
  steps: TestStep[];
  requirementId: string | null;
  state: string;
};
type RunInput = {
  title: string;
  suiteId: string | null;
  testerId: string;
  environment: string;
  build: string;
  clientKey: string;
  caseIds?: string[];
};
export class TestPlanService {
  async plan(projectId: string, id: string) {
    const [plan] = await db
      .select()
      .from(plans)
      .where(and(eq(plans.id, id), eq(plans.projectId, projectId)));
    if (!plan) throw new HTTPException(404, { message: "Test plan not found" });
    return plan;
  }
  async suite(projectId: string, id: string) {
    const [row] = await db
      .select({ suite: suites })
      .from(suites)
      .innerJoin(plans, eq(suites.planId, plans.id))
      .where(and(eq(suites.id, id), eq(plans.projectId, projectId)));
    if (!row) throw new HTTPException(404, { message: "Test suite not found" });
    return row.suite;
  }
  async run(projectId: string, id: string) {
    const [row] = await db
      .select({ run: runs })
      .from(runs)
      .innerJoin(plans, eq(runs.planId, plans.id))
      .where(and(eq(runs.id, id), eq(plans.projectId, projectId)));
    if (!row) throw new HTTPException(404, { message: "Test run not found" });
    return row.run;
  }
  async workItem(projectId: string, id: string | null, bug = false) {
    if (!id) return;
    const [item] = await db
      .select()
      .from(taskTable)
      .where(and(eq(taskTable.id, id), eq(taskTable.projectId, projectId)));
    if (!item || (bug && item.type !== "bug"))
      throw new HTTPException(400, {
        message: bug
          ? "Select a Bug in this project"
          : "Select a requirement in this project",
      });
  }
  async overview(projectId: string) {
    const [planRows, suiteRows, caseRows, linkRows, runRows] =
      await Promise.all([
        db
          .select()
          .from(plans)
          .where(eq(plans.projectId, projectId))
          .orderBy(desc(plans.createdAt)),
        db
          .select({ id: suites.id, planId: suites.planId, title: suites.title })
          .from(suites)
          .innerJoin(plans, eq(suites.planId, plans.id))
          .where(eq(plans.projectId, projectId)),
        db
          .select()
          .from(cases)
          .where(eq(cases.projectId, projectId))
          .orderBy(desc(cases.createdAt)),
        db
          .select({
            id: links.id,
            suiteId: links.suiteId,
            caseId: links.caseId,
          })
          .from(links)
          .innerJoin(suites, eq(links.suiteId, suites.id))
          .innerJoin(plans, eq(suites.planId, plans.id))
          .where(eq(plans.projectId, projectId)),
        db
          .select({ run: runs })
          .from(runs)
          .innerJoin(plans, eq(runs.planId, plans.id))
          .where(eq(plans.projectId, projectId))
          .orderBy(desc(runs.createdAt))
          .limit(100),
      ]);
    return {
      plans: planRows,
      suites: suiteRows,
      cases: caseRows,
      links: linkRows,
      runs: runRows.map((row) => row.run),
    };
  }
  async savePlan(projectId: string, input: PlanInput, id?: string) {
    if (id) await this.plan(projectId, id);
    if (input.sprintId) {
      const [sprint] = await db
        .select()
        .from(sprintTable)
        .where(
          and(
            eq(sprintTable.id, input.sprintId),
            eq(sprintTable.projectId, projectId),
          ),
        );
      if (!sprint)
        throw new HTTPException(400, {
          message: "Select a sprint in this project",
        });
    }
    const rows = id
      ? await db
          .update(plans)
          .set(input)
          .where(and(eq(plans.id, id), eq(plans.projectId, projectId)))
          .returning()
      : await db
          .insert(plans)
          .values({ projectId, ...input })
          .returning();
    return rows[0];
  }
  async saveSuite(
    projectId: string,
    planId: string,
    title: string,
    id?: string,
  ) {
    const plan = await this.plan(projectId, planId);
    if (plan.state !== "active")
      throw new HTTPException(409, {
        message: "Reopen this plan before changing suites",
      });
    if (id && (await this.suite(projectId, id)).planId !== planId)
      throw new HTTPException(404, { message: "Test suite not found" });
    const rows = id
      ? await db
          .update(suites)
          .set({ title })
          .where(eq(suites.id, id))
          .returning()
      : await db.insert(suites).values({ planId, title }).returning();
    return rows[0];
  }
  async saveCase(
    projectId: string,
    input: CaseInput,
    id?: string,
    revision?: number,
  ) {
    await this.workItem(projectId, input.requirementId);
    if (!id)
      return (
        await db
          .insert(cases)
          .values({ projectId, ...input })
          .returning()
      )[0];
    const [updated] = await db
      .update(cases)
      .set({ ...input, revision: (revision ?? 0) + 1 })
      .where(
        and(
          eq(cases.id, id),
          eq(cases.projectId, projectId),
          eq(cases.revision, revision ?? 0),
        ),
      )
      .returning();
    if (!updated)
      throw new HTTPException(409, {
        message: "Case changed or is unavailable. Reload before saving.",
      });
    return updated;
  }
  async attach(
    projectId: string,
    suiteId: string,
    caseId: string,
    remove = false,
  ) {
    const suite = await this.suite(projectId, suiteId);
    const plan = await this.plan(projectId, suite.planId);
    if (plan.state !== "active")
      throw new HTTPException(409, {
        message: "Reopen this plan before changing suites",
      });
    const [testCase] = await db
      .select()
      .from(cases)
      .where(and(eq(cases.id, caseId), eq(cases.projectId, projectId)));
    if (!testCase)
      throw new HTTPException(404, { message: "Test case not found" });
    if (remove)
      await db
        .delete(links)
        .where(and(eq(links.suiteId, suiteId), eq(links.caseId, caseId)));
    else
      await db.insert(links).values({ suiteId, caseId }).onConflictDoNothing();
    return { ok: true };
  }
  async tester(projectId: string, userId: string) {
    const [member] = await db
      .select({ role: userTable.role })
      .from(workspaceUserTable)
      .innerJoin(
        projectTable,
        eq(workspaceUserTable.workspaceId, projectTable.workspaceId),
      )
      .innerJoin(userTable, eq(workspaceUserTable.userId, userTable.id))
      .where(and(eq(projectTable.id, projectId), eq(userTable.id, userId)));
    if (
      !member ||
      (member.role !== "admin" &&
        !(await canInProject(userId, projectId, "test", "execute")))
    )
      throw new HTTPException(400, {
        message: "Tester must be a project tester with workspace membership",
      });
  }
  async start(
    projectId: string,
    planId: string,
    input: RunInput,
    actor: string,
  ) {
    await this.plan(projectId, planId);
    if (
      input.testerId !== actor &&
      !(await canInProject(actor, projectId, "test", "manage"))
    ) {
      const [actorUser] = await db
        .select({ role: userTable.role })
        .from(userTable)
        .where(eq(userTable.id, actor));
      if (actorUser?.role !== "admin")
        throw new HTTPException(403, {
          message: "Only a test manager can assign runs to other testers",
        });
    }
    await this.tester(projectId, input.testerId);
    return db.transaction(async (tx) => {
      const [plan] = await tx
        .select()
        .from(plans)
        .where(and(eq(plans.id, planId), eq(plans.projectId, projectId)))
        .for("update");
      if (!plan || plan.state !== "active")
        throw new HTTPException(409, {
          message: "Reopen this plan before starting runs",
        });
      const [existing] = await tx
        .select()
        .from(runs)
        .where(
          and(eq(runs.planId, planId), eq(runs.clientKey, input.clientKey)),
        );
      if (existing) {
        if (existing.createdBy !== actor)
          throw new HTTPException(409, {
            message: "Run request key already used",
          });
        return existing;
      }
      if (input.suiteId) {
        const [suite] = await tx
          .select()
          .from(suites)
          .where(and(eq(suites.id, input.suiteId), eq(suites.planId, planId)));
        if (!suite)
          throw new HTTPException(404, { message: "Test suite not found" });
      }
      const source = await tx
        .select({ testCase: cases })
        .from(links)
        .innerJoin(suites, eq(links.suiteId, suites.id))
        .innerJoin(cases, eq(links.caseId, cases.id))
        .where(
          and(
            eq(suites.planId, planId),
            eq(cases.projectId, projectId),
            eq(cases.state, "ready"),
            input.suiteId ? eq(suites.id, input.suiteId) : undefined,
          ),
        );
      const available = new Map(
        source.map((row) => [row.testCase.id, row.testCase]),
      );
      if (input.caseIds?.some((id) => !available.has(id)))
        throw new HTTPException(400, {
          message: "Selected cases must be Ready and belong to this plan/suite",
        });
      const selected = input.caseIds
        ? [...new Set(input.caseIds)]
            .map((id) => available.get(id))
            .filter((row) => row !== undefined)
        : [...available.values()];
      if (!selected.length || selected.length > 500)
        throw new HTTPException(400, {
          message: "A run must contain 1 to 500 Ready cases",
        });
      if (
        new TextEncoder().encode(JSON.stringify(selected)).byteLength >
        5 * 1024 * 1024
      )
        throw new HTTPException(400, {
          message: "Reduce the selection: a run snapshot must fit within 5 MiB",
        });
      const [run] = await tx
        .insert(runs)
        .values({
          planId,
          suiteId: input.suiteId,
          title: input.title,
          testerId: input.testerId,
          createdBy: actor,
          environment: input.environment,
          build: input.build,
          clientKey: input.clientKey,
        })
        .returning();
      if (!run)
        throw new HTTPException(500, { message: "Unable to start test run" });
      await tx.insert(results).values(
        selected.map((testCase) => ({
          runId: run.id,
          caseId: testCase.id,
          snapshot: {
            caseId: testCase.id,
            revision: testCase.revision,
            title: testCase.title,
            preconditions: testCase.preconditions,
            steps: testCase.steps,
            requirementId: testCase.requirementId,
          },
          steps: testCase.steps.map(() => ({
            outcome: "not_run" as const,
            actual: "",
          })),
        })),
      );
      return run;
    });
  }
  async detail(projectId: string, runId: string) {
    const run = await this.run(projectId, runId);
    const rows = await db
      .select()
      .from(results)
      .where(eq(results.runId, runId))
      .orderBy(results.id);
    return { run, results: rows, summary: summarizeResults(rows) };
  }
  async saveResult(
    projectId: string,
    runId: string,
    resultId: string,
    input: {
      version: number;
      outcome: Outcome;
      steps: StepResult[];
      actual: string;
      evidence: string[];
      bugId: string | null;
    },
    actor: string,
    manager: boolean,
  ) {
    await this.run(projectId, runId);
    await this.workItem(projectId, input.bugId, true);
    return db.transaction(async (tx) => {
      const [run] = await tx
        .select()
        .from(runs)
        .where(eq(runs.id, runId))
        .for("update");
      if (!run || run.state !== "in_progress")
        throw new HTTPException(409, {
          message: "Only an In progress run can be edited",
        });
      if (run.testerId !== actor && !manager)
        throw new HTTPException(403, {
          message:
            "Only the assigned tester or a test manager can edit this run",
        });
      const [result] = await tx
        .select()
        .from(results)
        .where(and(eq(results.id, resultId), eq(results.runId, runId)));
      if (!result)
        throw new HTTPException(404, { message: "Test result not found" });
      if (result.version !== input.version)
        throw new HTTPException(409, {
          message: "Result changed. Reload before saving.",
        });
      const error = validateResult(
        input.outcome,
        input.steps,
        result.snapshot.steps.length,
      );
      if (error) throw new HTTPException(400, { message: error });
      if (
        (input.outcome === "blocked" || input.outcome === "not_applicable") &&
        !input.actual.trim()
      )
        throw new HTTPException(400, {
          message: "Give a reason for Blocked or Not applicable",
        });
      const [updated] = await tx
        .update(results)
        .set({
          ...input,
          version: input.version + 1,
          updatedBy: actor,
          updatedAt: new Date(),
        })
        .where(eq(results.id, resultId))
        .returning();
      return updated;
    });
  }
  async transition(
    projectId: string,
    runId: string,
    state: string,
    version: number,
    actor: string,
    manager: boolean,
  ) {
    await this.run(projectId, runId);
    return db.transaction(async (tx) => {
      const [run] = await tx
        .select()
        .from(runs)
        .where(eq(runs.id, runId))
        .for("update");
      if (!run || run.version !== version)
        throw new HTTPException(409, {
          message: "Run changed. Reload before saving.",
        });
      if (run.testerId !== actor && !manager)
        throw new HTTPException(403, {
          message:
            "Only the assigned tester or a test manager can change this run",
        });
      if (run.state === "completed" || run.state === "aborted")
        throw new HTTPException(409, {
          message: "Closed runs are immutable. Start a new run to retest.",
        });
      if (
        (state === "in_progress" && run.state !== "paused") ||
        (state === "paused" && run.state !== "in_progress")
      )
        throw new HTTPException(409, { message: "Invalid run transition" });
      if (state === "completed") {
        const rows = await tx
          .select()
          .from(results)
          .where(eq(results.runId, runId));
        if (rows.some((row) => row.outcome === "not_run"))
          throw new HTTPException(400, {
            message:
              "Resolve all Not run cases before completing, or abort the run",
          });
      }
      return (
        await tx
          .update(runs)
          .set({
            state,
            version: version + 1,
            completedAt:
              state === "completed" || state === "aborted" ? new Date() : null,
          })
          .where(eq(runs.id, runId))
          .returning()
      )[0];
    });
  }
}
export const testPlanService = new TestPlanService();
