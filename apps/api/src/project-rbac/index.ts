import { Hono } from "hono";
import { describeRoute, validator } from "hono-openapi";
import * as v from "valibot";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { resolveProjectStatements } from "./can-in-project";
import { PROJECT_PERMISSION_CATALOG } from "./catalog";
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
      const { roleId } = c.req.valid("param");
      const { name, permissions } = c.req.valid("json");
      const updated = await updateRoleCtrl(roleId, name, permissions);
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
      const { roleId } = c.req.valid("param");
      await deleteRoleCtrl(roleId);
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
      const { memberId } = c.req.valid("param");
      const { roleIds } = c.req.valid("json");
      await assignMemberRolesCtrl(memberId, roleIds);
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
      const { memberId } = c.req.valid("param");
      await removeMemberCtrl(memberId);
      return c.json({ success: true });
    },
  );

export default projectRbac;
