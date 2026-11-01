import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import { adminAuditRequest } from "./audit/admin-audit-request";
import banUser from "./controllers/ban-user";
import createUser from "./controllers/create-user";
import deleteUser from "./controllers/delete-user";
import listAuditLog from "./controllers/list-audit-log";
import listUserApiKeys from "./controllers/list-user-api-keys";
import listUserSessions from "./controllers/list-user-sessions";
import listUsers from "./controllers/list-users";
import revokeUserApiKeys from "./controllers/revoke-user-api-keys";
import revokeUserSessions from "./controllers/revoke-user-sessions";
import setUserRole from "./controllers/set-user-role";
import unbanUser from "./controllers/unban-user";
import adminInstanceRoutes from "./instance-routes";
import roleRoutes from "./role-routes";
import { getInstanceAccess } from "./roles/get-instance-access";
import { requireInstancePermission } from "./roles/require-instance-permission";
import { adminRoutePermission } from "./roles/route-permission";
import {
  adminApiKeySchema,
  adminSessionSchema,
  adminUserSchema,
  auditEntrySchema,
  banUserBody,
  createUserBody,
  listAuditLogQuery,
  listUsersQuery,
  setRoleBody,
  userIdParam,
} from "./schema";
import webhookRoutes from "./webhook-routes";

const jsonContent = (schema: v.GenericSchema) => ({
  "application/json": { schema: resolver(schema) },
});

const ok = (description: string, schema: v.GenericSchema) => ({
  200: { description, content: jsonContent(schema) },
});

const revokedSchema = v.object({ revoked: v.number() });

// Every protected route checks its specific permission in the database on
// each request. The audit log has no update or delete route.
const admin = new Hono<{
  Variables: {
    userId: string;
    session: { id: string } | null;
    apiKey?: { id: string };
  };
}>()
  .get(
    "/access",
    describeRoute({
      operationId: "adminGetInstanceAccess",
      tags: ["Admin"],
      description:
        "Current user's instance permissions, read freshly from the database",
    }),
    async (c) => {
      if (c.get("apiKey"))
        return c.json({ permissions: [] as string[], isAdmin: false });
      return c.json(await getInstanceAccess(c.get("userId")));
    },
  )
  .use("*", requireInstancePermission(adminRoutePermission))
  .get(
    "/users",
    describeRoute({
      operationId: "adminListUsers",
      tags: ["Admin"],
      description: "List and filter instance users (requires users:read)",
      responses: ok(
        "Users",
        v.object({ users: v.array(adminUserSchema), total: v.number() }),
      ),
    }),
    validator("query", listUsersQuery),
    async (c) => {
      const { includeGuests, ...query } = c.req.valid("query");
      return c.json(
        await listUsers({ ...query, includeGuests: includeGuests === "true" }),
      );
    },
  )
  .post(
    "/users",
    describeRoute({
      operationId: "adminCreateUser",
      tags: ["Admin"],
      description:
        "Create a user with an optional password; otherwise email a setup link when SMTP is configured",
      responses: ok(
        "Created user",
        v.object({
          id: v.string(),
          name: v.string(),
          email: v.string(),
          role: v.picklist(["admin", "user"]),
          setupEmailSent: v.boolean(),
        }),
      ),
    }),
    validator("json", createUserBody),
    async (c) => {
      const body = c.req.valid("json");
      return c.json(await createUser(adminAuditRequest(c), body));
    },
  )
  .patch(
    "/users/:userId/role",
    describeRoute({
      operationId: "adminSetUserRole",
      tags: ["Admin"],
      description: "Change a user's instance role",
      responses: ok(
        "Updated role",
        v.object({
          id: v.string(),
          role: v.picklist(["admin", "user"]),
          changed: v.boolean(),
        }),
      ),
    }),
    validator("param", userIdParam),
    validator("json", setRoleBody),
    async (c) => {
      const { userId } = c.req.valid("param");
      const { role } = c.req.valid("json");
      return c.json(await setUserRole(adminAuditRequest(c), userId, role));
    },
  )
  .post(
    "/users/:userId/ban",
    describeRoute({
      operationId: "adminBanUser",
      tags: ["Admin"],
      description: "Ban a user and revoke their sessions",
      responses: ok(
        "Banned",
        v.object({ id: v.string(), banned: v.boolean() }),
      ),
    }),
    validator("param", userIdParam),
    validator("json", banUserBody),
    async (c) => {
      const { userId } = c.req.valid("param");
      const body = c.req.valid("json");
      return c.json(await banUser(adminAuditRequest(c), userId, body));
    },
  )
  .post(
    "/users/:userId/unban",
    describeRoute({
      operationId: "adminUnbanUser",
      tags: ["Admin"],
      description: "Lift a user's ban",
      responses: ok(
        "Unbanned",
        v.object({ id: v.string(), banned: v.boolean() }),
      ),
    }),
    validator("param", userIdParam),
    async (c) => {
      const { userId } = c.req.valid("param");
      return c.json(await unbanUser(adminAuditRequest(c), userId));
    },
  )
  .delete(
    "/users/:userId",
    describeRoute({
      operationId: "adminDeleteUser",
      tags: ["Admin"],
      description: "Delete a user account",
      responses: ok(
        "Deleted",
        v.object({ id: v.string(), deleted: v.boolean() }),
      ),
    }),
    validator("param", userIdParam),
    async (c) => {
      const { userId } = c.req.valid("param");
      return c.json(await deleteUser(adminAuditRequest(c), userId));
    },
  )
  .get(
    "/users/:userId/sessions",
    describeRoute({
      operationId: "adminListUserSessions",
      tags: ["Admin"],
      description: "List a user's active sessions (tokens are never returned)",
      responses: ok("Sessions", v.array(adminSessionSchema)),
    }),
    validator("param", userIdParam),
    async (c) => {
      const { userId } = c.req.valid("param");
      return c.json(
        await listUserSessions(userId, c.get("session")?.id ?? null),
      );
    },
  )
  .delete(
    "/users/:userId/sessions",
    describeRoute({
      operationId: "adminRevokeUserSessions",
      tags: ["Admin"],
      description: "Revoke all of a user's sessions",
      responses: ok("Revoked", revokedSchema),
    }),
    validator("param", userIdParam),
    async (c) => {
      const { userId } = c.req.valid("param");
      return c.json(await revokeUserSessions(adminAuditRequest(c), userId));
    },
  )
  .delete(
    "/users/:userId/sessions/:sessionId",
    describeRoute({
      operationId: "adminRevokeUserSession",
      tags: ["Admin"],
      description: "Revoke one of a user's sessions",
      responses: ok("Revoked", revokedSchema),
    }),
    validator("param", v.object({ userId: v.string(), sessionId: v.string() })),
    async (c) => {
      const { userId, sessionId } = c.req.valid("param");
      return c.json(
        await revokeUserSessions(adminAuditRequest(c), userId, sessionId),
      );
    },
  )
  .get(
    "/users/:userId/api-keys",
    describeRoute({
      operationId: "adminListUserApiKeys",
      tags: ["Admin"],
      description: "List a user's API keys (prefix only, never the key)",
      responses: ok("API keys", v.array(adminApiKeySchema)),
    }),
    validator("param", userIdParam),
    async (c) => {
      const { userId } = c.req.valid("param");
      return c.json(await listUserApiKeys(userId));
    },
  )
  .delete(
    "/users/:userId/api-keys",
    describeRoute({
      operationId: "adminRevokeUserApiKeys",
      tags: ["Admin"],
      description: "Revoke all of a user's API keys",
      responses: ok("Revoked", revokedSchema),
    }),
    validator("param", userIdParam),
    async (c) => {
      const { userId } = c.req.valid("param");
      return c.json(await revokeUserApiKeys(adminAuditRequest(c), userId));
    },
  )
  .delete(
    "/users/:userId/api-keys/:keyId",
    describeRoute({
      operationId: "adminRevokeUserApiKey",
      tags: ["Admin"],
      description: "Revoke one of a user's API keys",
      responses: ok("Revoked", revokedSchema),
    }),
    validator("param", v.object({ userId: v.string(), keyId: v.string() })),
    async (c) => {
      const { userId, keyId } = c.req.valid("param");
      return c.json(
        await revokeUserApiKeys(adminAuditRequest(c), userId, keyId),
      );
    },
  )
  .get(
    "/audit-log",
    describeRoute({
      operationId: "adminListAuditLog",
      tags: ["Admin"],
      description: "Page through the instance admin audit log",
      responses: ok(
        "Audit log entries",
        v.object({ entries: v.array(auditEntrySchema), total: v.number() }),
      ),
    }),
    validator("query", listAuditLogQuery),
    async (c) => {
      return c.json(await listAuditLog(c.req.valid("query")));
    },
  )
  .route("/", roleRoutes)
  .route("/", webhookRoutes)
  .route("/", adminInstanceRoutes);

export default admin;
