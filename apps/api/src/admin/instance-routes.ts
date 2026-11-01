import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import { INTEGRATION_TYPES } from "../instance-settings/resolve-instance-settings";
import { adminAuditRequest } from "./audit/admin-audit-request";
import deleteWorkspace from "./controllers/delete-workspace";
import getAdminSettings from "./controllers/get-admin-settings";
import getSystemStatus from "./controllers/get-system-status";
import listWorkspaces from "./controllers/list-workspaces";
import sendAdminTestEmail from "./controllers/send-test-email";
import setWorkspaceArchived from "./controllers/set-workspace-archived";
import updateAdminSettings from "./controllers/update-admin-settings";
import verifySmtp from "./controllers/verify-smtp";
import { requireInstanceAdmin } from "./require-instance-admin";

const jsonContent = (schema: v.GenericSchema) => ({
  "application/json": { schema: resolver(schema) },
});

const ok = (description: string, schema: v.GenericSchema) => ({
  200: { description, content: jsonContent(schema) },
});

const serviceStatus = v.picklist(["ok", "down", "not_configured"]);

const systemStatusSchema = v.object({
  version: v.nullable(v.string()),
  nodeVersion: v.string(),
  uptimeSeconds: v.number(),
  database: v.object({
    status: serviceStatus,
    latencyMs: v.nullable(v.number()),
    migrationsApplied: v.nullable(v.number()),
    lastMigrationAt: v.nullable(v.string()),
    errorCode: v.nullable(v.string()),
  }),
  redis: v.object({
    status: serviceStatus,
    errorCode: v.nullable(v.string()),
  }),
  email: v.object({ configured: v.boolean(), host: v.nullable(v.string()) }),
  storage: v.object({ documentDriver: v.string(), s3Configured: v.boolean() }),
});

const envLockable = v.picklist([
  "registrationEnabled",
  "passwordRegistrationEnabled",
  "requireEmailVerification",
  "workspaceCreationRestricted",
]);

const adminSettingsSchema = v.object({
  instanceName: v.nullable(v.string()),
  registrationEnabled: v.boolean(),
  passwordRegistrationEnabled: v.boolean(),
  requireEmailVerification: v.boolean(),
  workspaceCreationRestricted: v.boolean(),
  disabledIntegrations: v.array(v.string()),
  lockedByEnv: v.array(envLockable),
  emailDeliveryConfigured: v.boolean(),
  integrationTypes: v.array(v.string()),
});

const updateSettingsBody = v.pipe(
  v.object({
    instanceName: v.optional(
      v.nullable(v.pipe(v.string(), v.trim(), v.maxLength(60))),
    ),
    registrationEnabled: v.optional(v.boolean()),
    passwordRegistrationEnabled: v.optional(v.boolean()),
    requireEmailVerification: v.optional(v.boolean()),
    workspaceCreationRestricted: v.optional(v.boolean()),
    disabledIntegrations: v.optional(
      v.pipe(v.array(v.picklist(INTEGRATION_TYPES)), v.maxLength(32)),
    ),
  }),
  v.check(
    (body) => Object.values(body).some((value) => value !== undefined),
    "Nothing to update",
  ),
);

const adminWorkspaceSchema = v.object({
  id: v.string(),
  name: v.string(),
  slug: v.string(),
  createdAt: v.string(),
  archivedAt: v.nullable(v.string()),
  memberCount: v.number(),
  projectCount: v.number(),
});

const listWorkspacesQuery = v.object({
  search: v.optional(v.pipe(v.string(), v.maxLength(200))),
  status: v.optional(v.picklist(["all", "active", "archived"])),
  page: v.optional(
    v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(1)),
    "1",
  ),
  limit: v.optional(
    v.pipe(
      v.string(),
      v.toNumber(),
      v.integer(),
      v.minValue(1),
      v.maxValue(100),
    ),
    "50",
  ),
});

const workspaceIdParam = v.object({
  workspaceId: v.pipe(v.string(), v.minLength(1)),
});

const archiveResultSchema = v.object({
  id: v.string(),
  archivedAt: v.nullable(v.string()),
  changed: v.boolean(),
});

// System status, instance settings and the workspace lifecycle. Mounted under
// /api/admin; every route re-checks instance admin status in the database.
const adminInstanceRoutes = new Hono<{
  Variables: {
    userId: string;
    apiKey?: { id: string };
  };
}>()
  .use("*", requireInstanceAdmin)
  .get(
    "/system",
    describeRoute({
      operationId: "adminGetSystemStatus",
      tags: ["Admin"],
      description:
        "Version, uptime and the health of the database, Redis, email and storage",
      responses: ok("System status", systemStatusSchema),
    }),
    async (c) => c.json(await getSystemStatus()),
  )
  .post(
    "/system/verify-smtp",
    describeRoute({
      operationId: "adminVerifySmtp",
      tags: ["Admin"],
      description:
        "Connect and authenticate to the SMTP server without sending mail",
      responses: ok(
        "Verification result",
        v.object({
          status: v.picklist(["ok", "failed", "not_configured"]),
          code: v.nullable(v.string()),
          responseCode: v.nullable(v.number()),
        }),
      ),
    }),
    async (c) => c.json(await verifySmtp(adminAuditRequest(c))),
  )
  .post(
    "/system/test-email",
    describeRoute({
      operationId: "adminSendTestEmail",
      tags: ["Admin"],
      description:
        "Send a test email to the calling administrator (rate limited)",
      responses: ok("Sent", v.object({ sent: v.boolean(), to: v.string() })),
    }),
    async (c) => c.json(await sendAdminTestEmail(adminAuditRequest(c))),
  )
  .get(
    "/settings",
    describeRoute({
      operationId: "adminGetSettings",
      tags: ["Admin"],
      description:
        "Instance settings with environment overrides applied and the locked keys",
      responses: ok("Settings", adminSettingsSchema),
    }),
    async (c) => c.json(await getAdminSettings()),
  )
  .patch(
    "/settings",
    describeRoute({
      operationId: "adminUpdateSettings",
      tags: ["Admin"],
      description:
        "Change instance settings. Settings locked by an environment variable return 409.",
      responses: ok("Updated settings", adminSettingsSchema),
    }),
    validator("json", updateSettingsBody),
    async (c) =>
      c.json(
        await updateAdminSettings(adminAuditRequest(c), c.req.valid("json")),
      ),
  )
  .get(
    "/workspaces",
    describeRoute({
      operationId: "adminListWorkspaces",
      tags: ["Admin"],
      description: "List every workspace on the instance",
      responses: ok(
        "Workspaces",
        v.object({
          workspaces: v.array(adminWorkspaceSchema),
          total: v.number(),
        }),
      ),
    }),
    validator("query", listWorkspacesQuery),
    async (c) => c.json(await listWorkspaces(c.req.valid("query"))),
  )
  .post(
    "/workspaces/:workspaceId/archive",
    describeRoute({
      operationId: "adminArchiveWorkspace",
      tags: ["Admin"],
      description:
        "Archive a workspace: it stays readable but becomes read-only",
      responses: ok("Archived", archiveResultSchema),
    }),
    validator("param", workspaceIdParam),
    async (c) => {
      const { workspaceId } = c.req.valid("param");
      return c.json(
        await setWorkspaceArchived(adminAuditRequest(c), workspaceId, true),
      );
    },
  )
  .post(
    "/workspaces/:workspaceId/unarchive",
    describeRoute({
      operationId: "adminUnarchiveWorkspace",
      tags: ["Admin"],
      description: "Restore an archived workspace",
      responses: ok("Restored", archiveResultSchema),
    }),
    validator("param", workspaceIdParam),
    async (c) => {
      const { workspaceId } = c.req.valid("param");
      return c.json(
        await setWorkspaceArchived(adminAuditRequest(c), workspaceId, false),
      );
    },
  )
  .delete(
    "/workspaces/:workspaceId",
    describeRoute({
      operationId: "adminDeleteWorkspace",
      tags: ["Admin"],
      description:
        "Permanently delete a workspace and its data. Requires the workspace name as confirmation.",
      responses: ok(
        "Deleted",
        v.object({ id: v.string(), name: v.string(), deleted: v.boolean() }),
      ),
    }),
    validator("param", workspaceIdParam),
    validator(
      "json",
      v.object({ confirmName: v.pipe(v.string(), v.minLength(1)) }),
    ),
    async (c) => {
      const { workspaceId } = c.req.valid("param");
      const { confirmName } = c.req.valid("json");
      return c.json(
        await deleteWorkspace(adminAuditRequest(c), workspaceId, confirmName),
      );
    },
  );

export default adminInstanceRoutes;
