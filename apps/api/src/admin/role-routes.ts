import { and, count, eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { describeRoute, validator } from "hono-openapi";
import * as v from "valibot";
import db, { schema } from "../database";
import {
  instanceRoleAssignmentTable,
  instanceRoleTable,
} from "../database/admin-schema";
import { adminAuditRequest } from "./audit/admin-audit-request";
import { recordAdminAction } from "./audit/record-admin-action";
import {
  CUSTOM_ROLE_PERMISSIONS,
  normalizeInstancePermissions,
} from "./roles/permissions";

const body = v.object({
  name: v.pipe(
    v.string(),
    v.regex(/^[a-z][a-z0-9-]{1,31}$/),
    v.check((name) => !["admin", "user"].includes(name), "Reserved role name"),
  ),
  permissions: v.pipe(
    v.array(v.picklist(CUSTOM_ROLE_PERMISSIONS)),
    v.maxLength(CUSTOM_ROLE_PERMISSIONS.length),
  ),
});
const roleParam = v.object({ roleId: v.pipe(v.string(), v.minLength(1)) });
const info = (operationId: string) =>
  describeRoute({
    operationId,
    tags: ["Admin"],
    description: "Manage custom instance roles (built-in administrator only)",
  });

const roles = new Hono<{
  Variables: { userId: string; apiKey?: { id: string } };
}>()
  .get("/roles", info("adminListInstanceRoles"), async (c) => {
    const rows = await db
      .select()
      .from(instanceRoleTable)
      .orderBy(instanceRoleTable.name);
    const assignments = await db
      .select({
        userId: instanceRoleAssignmentTable.userId,
        roleId: instanceRoleAssignmentTable.roleId,
      })
      .from(instanceRoleAssignmentTable);
    return c.json({
      roles: rows,
      assignments,
      permissions: CUSTOM_ROLE_PERMISSIONS,
    });
  })
  .post(
    "/roles",
    info("adminCreateInstanceRole"),
    validator("json", body),
    async (c) => {
      const input = c.req.valid("json");
      return c.json(
        await db.transaction(async (tx) => {
          const [row] = await tx
            .insert(instanceRoleTable)
            .values({
              ...input,
              permissions: normalizeInstancePermissions(input.permissions),
            })
            .onConflictDoNothing()
            .returning();
          if (!row)
            throw new HTTPException(409, {
              message: "Role name already exists",
            });
          await recordAdminAction(
            adminAuditRequest(c),
            {
              action: "role.created",
              targetType: "instance_role",
              targetId: row.id,
              targetLabel: row.name,
              metadata: { permissions: row.permissions },
            },
            tx,
          );
          return row;
        }),
        201,
      );
    },
  )
  .put(
    "/roles/:roleId",
    info("adminUpdateInstanceRole"),
    validator("param", roleParam),
    validator("json", body),
    async (c) => {
      const input = c.req.valid("json");
      const roleId = c.req.valid("param").roleId;
      return c.json(
        await db.transaction(async (tx) => {
          const [existing] = await tx
            .select()
            .from(instanceRoleTable)
            .where(eq(instanceRoleTable.id, roleId))
            .for("update");
          if (!existing)
            throw new HTTPException(404, { message: "Role not found" });
          const [duplicate] = await tx
            .select({ id: instanceRoleTable.id })
            .from(instanceRoleTable)
            .where(eq(instanceRoleTable.name, input.name));
          if (duplicate && duplicate.id !== roleId)
            throw new HTTPException(409, {
              message: "Role name already exists",
            });
          const [updated] = await tx
            .update(instanceRoleTable)
            .set({
              ...input,
              permissions: normalizeInstancePermissions(input.permissions),
            })
            .where(eq(instanceRoleTable.id, roleId))
            .returning();
          await recordAdminAction(
            adminAuditRequest(c),
            {
              action: "role.updated",
              targetType: "instance_role",
              targetId: roleId,
              targetLabel: input.name,
              metadata: { permissions: input.permissions },
            },
            tx,
          );
          return updated;
        }),
      );
    },
  )
  .delete(
    "/roles/:roleId",
    info("adminDeleteInstanceRole"),
    validator("param", roleParam),
    async (c) => {
      const roleId = c.req.valid("param").roleId;
      return c.json(
        await db.transaction(async (tx) => {
          const [existing] = await tx
            .select()
            .from(instanceRoleTable)
            .where(eq(instanceRoleTable.id, roleId))
            .for("update");
          if (!existing)
            throw new HTTPException(404, { message: "Role not found" });
          const [assigned] = await tx
            .select({ value: count() })
            .from(instanceRoleAssignmentTable)
            .where(eq(instanceRoleAssignmentTable.roleId, roleId));
          if ((assigned?.value ?? 0) > 0)
            throw new HTTPException(409, {
              message: "Remove role assignments before deleting the role",
            });
          await tx
            .delete(instanceRoleTable)
            .where(eq(instanceRoleTable.id, roleId));
          await recordAdminAction(
            adminAuditRequest(c),
            {
              action: "role.deleted",
              targetType: "instance_role",
              targetId: roleId,
              targetLabel: existing.name,
            },
            tx,
          );
          return { id: roleId };
        }),
      );
    },
  )
  .put(
    "/users/:userId/instance-role",
    info("adminAssignInstanceRole"),
    validator(
      "param",
      v.object({ userId: v.pipe(v.string(), v.minLength(1)) }),
    ),
    validator(
      "json",
      v.object({ roleId: v.nullable(v.pipe(v.string(), v.minLength(1))) }),
    ),
    async (c) => {
      const { userId } = c.req.valid("param");
      const { roleId } = c.req.valid("json");
      if (userId === c.get("userId"))
        throw new HTTPException(400, {
          message: "You cannot change your own instance role",
        });
      await db.transaction(async (tx) => {
        const [target] = await tx
          .select({ id: schema.userTable.id, role: schema.userTable.role })
          .from(schema.userTable)
          .where(eq(schema.userTable.id, userId))
          .for("update");
        if (!target)
          throw new HTTPException(404, { message: "User not found" });
        if (target.role === "admin")
          throw new HTTPException(400, {
            message: "Built-in administrators already hold every permission",
          });
        if (roleId) {
          const [role] = await tx
            .select()
            .from(instanceRoleTable)
            .where(eq(instanceRoleTable.id, roleId))
            .for("update");
          if (!role)
            throw new HTTPException(404, { message: "Role not found" });
          await tx
            .insert(instanceRoleAssignmentTable)
            .values({ userId, roleId })
            .onConflictDoUpdate({
              target: instanceRoleAssignmentTable.userId,
              set: { roleId },
            });
        } else
          await tx
            .delete(instanceRoleAssignmentTable)
            .where(and(eq(instanceRoleAssignmentTable.userId, userId)));
        await recordAdminAction(
          adminAuditRequest(c),
          {
            action: "role.assigned",
            targetType: "user",
            targetId: userId,
            metadata: { roleId },
          },
          tx,
        );
      });
      return c.json({ userId, roleId });
    },
  );

export default roles;
