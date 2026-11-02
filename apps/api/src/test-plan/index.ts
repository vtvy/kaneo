import { Hono } from "hono";
import { describeRoute, validator } from "hono-openapi";
import * as v from "valibot";
import { canInProject } from "../project-rbac/can-in-project";
import { projectPermission } from "../project-rbac/require-project-permission";
import { isInstanceAdmin } from "../utils/is-instance-admin";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { OUTCOMES } from "./model";
import { testPlanService as service } from "./service";

const title = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(500));
const text = v.pipe(v.string(), v.maxLength(20000));
const id = v.pipe(v.string(), v.minLength(1), v.maxLength(200));
const version = v.pipe(v.number(), v.integer(), v.minValue(1));
const planFields = {
  title,
  description: text,
  sprintId: v.nullable(id),
  release: v.pipe(v.string(), v.maxLength(500)),
  state: v.picklist(["active", "archived"]),
};
const caseFields = {
  title,
  preconditions: text,
  steps: v.pipe(
    v.array(
      v.object({
        action: title,
        expected: v.pipe(
          v.string(),
          v.trim(),
          v.minLength(1),
          v.maxLength(5000),
        ),
      }),
    ),
    v.minLength(1),
    v.maxLength(100),
  ),
  requirementId: v.nullable(id),
  state: v.picklist(["draft", "ready", "retired"]),
};
const scope = workspaceAccess.fromProject("projectId");
const read = projectPermission.fromParam({ test: ["read"] }, "projectId");
const design = projectPermission.fromParam(
  { test: ["read", "design"] },
  "projectId",
);
const manage = projectPermission.fromParam(
  { test: ["read", "manage"] },
  "projectId",
);
const execute = projectPermission.fromParam(
  { test: ["read", "execute"] },
  "projectId",
);

const testPlans = new Hono<{
  Variables: { userId: string; workspaceId: string };
}>()
  .get(
    "/:projectId",
    describeRoute({
      operationId: "listProjectTestPlans",
      tags: ["Test Plans"],
      description: "listProjectTestPlans within an authorized project",
    }),
    scope,
    read,
    async (c) => c.json(await service.overview(c.req.param("projectId") ?? "")),
  )
  .post(
    "/:projectId/plans",
    describeRoute({
      operationId: "createTestPlan",
      tags: ["Test Plans"],
      description: "createTestPlan within an authorized project",
    }),
    validator("json", v.object(planFields)),
    scope,
    manage,
    async (c) =>
      c.json(
        await service.savePlan(
          c.req.param("projectId") ?? "",
          c.req.valid("json"),
        ),
      ),
  )
  .put(
    "/:projectId/plans/:planId",
    describeRoute({
      operationId: "updateTestPlan",
      tags: ["Test Plans"],
      description: "updateTestPlan within an authorized project",
    }),
    validator("json", v.object(planFields)),
    scope,
    manage,
    async (c) =>
      c.json(
        await service.savePlan(
          c.req.param("projectId") ?? "",
          c.req.valid("json"),
          c.req.param("planId") ?? "",
        ),
      ),
  )
  .post(
    "/:projectId/plans/:planId/suites",
    describeRoute({
      operationId: "createTestSuite",
      tags: ["Test Plans"],
      description: "createTestSuite within an authorized project",
    }),
    validator("json", v.object({ title })),
    scope,
    manage,
    async (c) =>
      c.json(
        await service.saveSuite(
          c.req.param("projectId") ?? "",
          c.req.param("planId") ?? "",
          c.req.valid("json").title,
        ),
      ),
  )
  .put(
    "/:projectId/plans/:planId/suites/:suiteId",
    describeRoute({
      operationId: "renameTestSuite",
      tags: ["Test Plans"],
      description: "renameTestSuite within an authorized project",
    }),
    validator("json", v.object({ title })),
    scope,
    manage,
    async (c) =>
      c.json(
        await service.saveSuite(
          c.req.param("projectId") ?? "",
          c.req.param("planId") ?? "",
          c.req.valid("json").title,
          c.req.param("suiteId") ?? "",
        ),
      ),
  )
  .post(
    "/:projectId/cases",
    describeRoute({
      operationId: "createManualTestCase",
      tags: ["Test Plans"],
      description: "createManualTestCase within an authorized project",
    }),
    validator("json", v.object(caseFields)),
    scope,
    design,
    async (c) =>
      c.json(
        await service.saveCase(
          c.req.param("projectId") ?? "",
          c.req.valid("json"),
        ),
      ),
  )
  .put(
    "/:projectId/cases/:caseId",
    describeRoute({
      operationId: "reviseManualTestCase",
      tags: ["Test Plans"],
      description: "reviseManualTestCase within an authorized project",
    }),
    validator("json", v.object({ ...caseFields, revision: version })),
    scope,
    design,
    async (c) =>
      c.json(
        await service.saveCase(
          c.req.param("projectId") ?? "",
          c.req.valid("json"),
          c.req.param("caseId") ?? "",
          c.req.valid("json").revision,
        ),
      ),
  )
  .post(
    "/:projectId/suites/:suiteId/cases/:caseId",
    describeRoute({
      operationId: "attachTestCase",
      tags: ["Test Plans"],
      description: "attachTestCase within an authorized project",
    }),
    scope,
    manage,
    async (c) =>
      c.json(
        await service.attach(
          c.req.param("projectId") ?? "",
          c.req.param("suiteId") ?? "",
          c.req.param("caseId") ?? "",
        ),
      ),
  )
  .delete(
    "/:projectId/suites/:suiteId/cases/:caseId",
    describeRoute({
      operationId: "detachTestCase",
      tags: ["Test Plans"],
      description: "detachTestCase within an authorized project",
    }),
    scope,
    manage,
    async (c) =>
      c.json(
        await service.attach(
          c.req.param("projectId") ?? "",
          c.req.param("suiteId") ?? "",
          c.req.param("caseId") ?? "",
          true,
        ),
      ),
  )
  .post(
    "/:projectId/plans/:planId/runs",
    describeRoute({
      operationId: "startManualTestRun",
      tags: ["Test Plans"],
      description: "startManualTestRun within an authorized project",
    }),
    validator(
      "json",
      v.object({
        title,
        suiteId: v.nullable(id),
        testerId: id,
        environment: v.pipe(v.string(), v.maxLength(1000)),
        build: v.pipe(v.string(), v.maxLength(1000)),
        clientKey: v.pipe(v.string(), v.minLength(8), v.maxLength(100)),
        caseIds: v.optional(
          v.pipe(v.array(id), v.minLength(1), v.maxLength(500)),
        ),
      }),
    ),
    scope,
    execute,
    async (c) =>
      c.json(
        await service.start(
          c.req.param("projectId") ?? "",
          c.req.param("planId") ?? "",
          c.req.valid("json"),
          c.get("userId"),
        ),
      ),
  )
  .get(
    "/:projectId/runs/:runId",
    describeRoute({
      operationId: "readManualTestRun",
      tags: ["Test Plans"],
      description: "readManualTestRun within an authorized project",
    }),
    scope,
    read,
    async (c) =>
      c.json(
        await service.detail(
          c.req.param("projectId") ?? "",
          c.req.param("runId") ?? "",
        ),
      ),
  )
  .put(
    "/:projectId/runs/:runId/results/:resultId",
    describeRoute({
      operationId: "saveManualTestResult",
      tags: ["Test Plans"],
      description: "saveManualTestResult within an authorized project",
    }),
    validator(
      "json",
      v.object({
        version,
        outcome: v.picklist(OUTCOMES),
        steps: v.pipe(
          v.array(v.object({ outcome: v.picklist(OUTCOMES), actual: text })),
          v.maxLength(100),
        ),
        actual: text,
        evidence: v.pipe(
          v.array(
            v.pipe(
              v.string(),
              v.maxLength(2000),
              v.url(),
              v.check((url) => {
                try {
                  const parsed = new URL(url);
                  return (
                    ["https:", "http:"].includes(parsed.protocol) &&
                    !parsed.username &&
                    !parsed.password
                  );
                } catch {
                  return false;
                }
              }, "Evidence must be an HTTP(S) URL without credentials"),
            ),
          ),
          v.maxLength(20),
        ),
        bugId: v.nullable(id),
      }),
    ),
    scope,
    execute,
    async (c) => {
      const projectId = c.req.param("projectId") ?? "";
      const manager =
        (await isInstanceAdmin(c)) ||
        (await canInProject(c.get("userId"), projectId, "test", "manage"));
      return c.json(
        await service.saveResult(
          projectId,
          c.req.param("runId") ?? "",
          c.req.param("resultId") ?? "",
          c.req.valid("json"),
          c.get("userId"),
          manager,
        ),
      );
    },
  )
  .patch(
    "/:projectId/runs/:runId",
    describeRoute({
      operationId: "transitionManualTestRun",
      tags: ["Test Plans"],
      description: "transitionManualTestRun within an authorized project",
    }),
    validator(
      "json",
      v.object({
        version,
        state: v.picklist(["in_progress", "paused", "completed", "aborted"]),
      }),
    ),
    scope,
    execute,
    async (c) => {
      const projectId = c.req.param("projectId") ?? "";
      const manager =
        (await isInstanceAdmin(c)) ||
        (await canInProject(c.get("userId"), projectId, "test", "manage"));
      return c.json(
        await service.transition(
          projectId,
          c.req.param("runId") ?? "",
          c.req.valid("json").state,
          c.req.valid("json").version,
          c.get("userId"),
          manager,
        ),
      );
    },
  );
export default testPlans;
