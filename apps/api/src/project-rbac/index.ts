import { and, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { describeRoute, validator } from "hono-openapi";
import * as v from "valibot";
import db, { schema } from "../database";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { resolveProjectStatements } from "./can-in-project";
import { PROJECT_PERMISSION_CATALOG, PROJECT_SYSTEM_OWNER } from "./catalog";
import addMemberCtrl from "./controllers/add-member";
import assignMemberRolesCtrl from "./controllers/assign-member-roles";
import createRoleCtrl from "./controllers/create-role";
import deleteRoleCtrl from "./controllers/delete-role";
import listMembersCtrl from "./controllers/list-members";
import listRolesCtrl from "./controllers/list-roles";
import removeMemberCtrl from "./controllers/remove-member";
import searchUserDirectoryCtrl from "./controllers/search-user-directory";
import updateRoleCtrl from "./controllers/update-role";
import { projectPermission } from "./require-project-permission";

// member:manage lets a role add people and pick their roles, but only an
// Owner may hand out Owner; otherwise any manager could promote themselves.
async function assertCallerIsProjectOwner(userId: string, projectId: string) {
  const { isOwner } = await resolveProjectStatements(userId, projectId);
  if (!isOwner) {
    throw new HTTPException(403, {
      message: "Only a project Owner can grant the Owner role",
    });
  }
}

async function includesOwnerRole(projectId: string, roleIds: string[]) {
  if (roleIds.length === 0) return false;
  const [ownerRole] = await db
    .select({ id: schema.projectRoleTable.id })
    .from(schema.projectRoleTable)
    .where(
      and(
        eq(schema.projectRoleTable.projectId, projectId),
        inArray(schema.projectRoleTable.id, roleIds),
        eq(schema.projectRoleTable.name, PROJECT_SYSTEM_OWNER),
        eq(schema.projectRoleTable.isSystem, true),
      ),
    )
    .limit(1);
  return Boolean(ownerRole);
}

const projectRbac = new Hono<{
  Variables: {
    userId: string;
    workspaceId: string;
  };
}>()
  .get(
    "/:projectId/permission-catalog",
    describeRoute({
      operationId: "getProjectPermissionCatalog",
      tags: ["Project RBAC"],
      description: "Get the permission catalog for project roles",
    }),
    validator("param", v.object({ projectId: v.string() })),
    workspaceAccess.fromProject("projectId"),
    async (c) => {
      return c.json(PROJECT_PERMISSION_CATALOG);
    },
  )
  .get(
    "/:projectId/me",
    describeRoute({
      operationId: "getMyProjectPermissions",
      tags: ["Project RBAC"],
      description: "Get the current user's permissions in a project",
    }),
    validator("param", v.object({ projectId: v.string() })),
    workspaceAccess.fromProject("projectId"),
    async (c) => {
      const userId = c.get("userId");
      const { projectId } = c.req.valid("param");
      const { statements, isOwner } = await resolveProjectStatements(
        userId,
        projectId,
      );
      const statementsJson: Record<string, string[]> = {};
      for (const [resource, actions] of Object.entries(statements)) {
        statementsJson[resource] = [...actions];
      }
      return c.json({ isOwner, statements: statementsJson });
    },
  )
  .get(
    "/:projectId/roles",
    describeRoute({
      operationId: "listProjectRoles",
      tags: ["Project RBAC"],
      description: "List all roles for a project",
    }),
    validator("param", v.object({ projectId: v.string() })),
    workspaceAccess.fromProject("projectId"),
    projectPermission.fromParam({ role: ["manage"] }),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const roles = await listRolesCtrl(projectId);
      return c.json(roles);
    },
  )
  .post(
    "/:projectId/roles",
    describeRoute({
      operationId: "createProjectRole",
      tags: ["Project RBAC"],
      description: "Create a new role for a project",
    }),
    validator("param", v.object({ projectId: v.string() })),
    validator(
      "json",
      v.object({
        name: v.string(),
        permissions: v.optional(v.record(v.string(), v.array(v.string())), {}),
      }),
    ),
    workspaceAccess.fromProject("projectId"),
    projectPermission.fromParam({ role: ["manage"] }),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const { name, permissions } = c.req.valid("json");
      const role = await createRoleCtrl(projectId, name, permissions ?? {});
      return c.json(role);
    },
  )
  .put(
    "/:projectId/roles/:roleId",
    describeRoute({
      operationId: "updateProjectRole",
      tags: ["Project RBAC"],
      description: "Update a project role's name or permissions",
    }),
    validator("param", v.object({ projectId: v.string(), roleId: v.string() })),
    validator(
      "json",
      v.object({
        name: v.optional(v.string()),
        permissions: v.optional(v.record(v.string(), v.array(v.string()))),
      }),
    ),
    workspaceAccess.fromProject("projectId"),
    projectPermission.fromParam({ role: ["manage"] }),
    async (c) => {
      const { projectId, roleId } = c.req.valid("param");
      const { name, permissions } = c.req.valid("json");
      const updated = await updateRoleCtrl(
        projectId,
        roleId,
        name,
        permissions,
      );
      return c.json(updated);
    },
  )
  .delete(
    "/:projectId/roles/:roleId",
    describeRoute({
      operationId: "deleteProjectRole",
      tags: ["Project RBAC"],
      description: "Delete a project role",
    }),
    validator("param", v.object({ projectId: v.string(), roleId: v.string() })),
    workspaceAccess.fromProject("projectId"),
    projectPermission.fromParam({ role: ["manage"] }),
    async (c) => {
      const { projectId, roleId } = c.req.valid("param");
      await deleteRoleCtrl(projectId, roleId);
      return c.json({ success: true });
    },
  )
  .get(
    "/:projectId/members",
    describeRoute({
      operationId: "listProjectMembers",
      tags: ["Project RBAC"],
      description: "List all members of a project",
    }),
    validator("param", v.object({ projectId: v.string() })),
    workspaceAccess.fromProject("projectId"),
    projectPermission.fromParam({ item: ["read"] }),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const members = await listMembersCtrl(projectId);
      return c.json(members);
    },
  )
  .get(
    "/:projectId/user-directory",
    describeRoute({
      operationId: "searchProjectUserDirectory",
      tags: ["Project RBAC"],
      description:
        "Search registered users who are not already members of this project (for add-member autocomplete)",
    }),
    validator("param", v.object({ projectId: v.string() })),
    validator(
      "query",
      v.object({
        q: v.optional(v.string()),
      }),
    ),
    workspaceAccess.fromProject("projectId"),
    projectPermission.fromParam({ member: ["manage"] }),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const { q } = c.req.valid("query");
      const users = await searchUserDirectoryCtrl(projectId, q ?? "");
      return c.json(users);
    },
  )
  .post(
    "/:projectId/members",
    describeRoute({
      operationId: "addProjectMember",
      tags: ["Project RBAC"],
      description:
        "Invite a user by email to the project (auto-adds to workspace if needed)",
    }),
    validator("param", v.object({ projectId: v.string() })),
    validator(
      "json",
      v.object({
        email: v.pipe(v.string(), v.email()),
        roleNames: v.optional(v.array(v.string()), []),
      }),
    ),
    workspaceAccess.fromProject("projectId"),
    projectPermission.fromParam({ member: ["manage"] }),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const { email, roleNames } = c.req.valid("json");
      if (roleNames?.includes(PROJECT_SYSTEM_OWNER)) {
        await assertCallerIsProjectOwner(c.get("userId"), projectId);
      }
      await addMemberCtrl(projectId, email, roleNames ?? []);
      return c.json({ success: true });
    },
  )
  .put(
    "/:projectId/members/:memberId/roles",
    describeRoute({
      operationId: "assignProjectMemberRoles",
      tags: ["Project RBAC"],
      description: "Replace a project member's roles",
    }),
    validator(
      "param",
      v.object({ projectId: v.string(), memberId: v.string() }),
    ),
    validator("json", v.object({ roleIds: v.array(v.string()) })),
    workspaceAccess.fromProject("projectId"),
    projectPermission.fromParam({ member: ["manage"] }),
    async (c) => {
      const { projectId, memberId } = c.req.valid("param");
      const { roleIds } = c.req.valid("json");
      if (await includesOwnerRole(projectId, roleIds)) {
        await assertCallerIsProjectOwner(c.get("userId"), projectId);
      }
      await assignMemberRolesCtrl(projectId, memberId, roleIds);
      return c.json({ success: true });
    },
  )
  .delete(
    "/:projectId/members/:memberId",
    describeRoute({
      operationId: "removeProjectMember",
      tags: ["Project RBAC"],
      description: "Remove a member from a project",
    }),
    validator(
      "param",
      v.object({ projectId: v.string(), memberId: v.string() }),
    ),
    workspaceAccess.fromProject("projectId"),
    projectPermission.fromParam({ member: ["manage"] }),
    async (c) => {
      const { projectId, memberId } = c.req.valid("param");
      await removeMemberCtrl(projectId, memberId);
      return c.json({ success: true });
    },
  );

export default projectRbac;
