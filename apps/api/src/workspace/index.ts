import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import db from "../database";
import { workspaceTable, workspaceUserTable } from "../database/schema";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import getWorkspaceMembersCtrl from "./controllers/get-workspace-members";
import searchUserDirectory from "./controllers/search-user-directory";

const directoryUserSchema = v.object({
  id: v.string(),
  name: v.string(),
  email: v.string(),
  image: v.nullable(v.string()),
});

const workspace = new Hono<{
  Variables: {
    userId: string;
    workspaceId: string;
  };
}>()
  .get(
    "/",
    describeRoute({
      operationId: "listWorkspaces",
      tags: ["Workspaces"],
      description: "List workspaces the authenticated user belongs to",
      responses: { 200: { description: "Workspace memberships" } },
    }),
    async (c) => {
      const memberships = await db
        .select({
          id: workspaceTable.id,
          name: workspaceTable.name,
          slug: workspaceTable.slug,
          logo: workspaceTable.logo,
          description: workspaceTable.description,
          createdAt: workspaceTable.createdAt,
          role: workspaceUserTable.role,
        })
        .from(workspaceTable)
        .innerJoin(
          workspaceUserTable,
          eq(workspaceUserTable.workspaceId, workspaceTable.id),
        )
        .where(eq(workspaceUserTable.userId, c.get("userId")));
      return c.json(memberships);
    },
  )
  .get(
    "/:workspaceId/archive-status",
    describeRoute({
      operationId: "getWorkspaceArchiveStatus",
      tags: ["Workspaces"],
      description:
        "Whether the workspace is archived (read-only) and since when",
      responses: {
        200: {
          description: "Archive status",
          content: {
            "application/json": {
              schema: resolver(
                v.object({
                  archived: v.boolean(),
                  archivedAt: v.nullable(v.string()),
                }),
              ),
            },
          },
        },
      },
    }),
    validator("param", v.object({ workspaceId: v.string() })),
    workspaceAccess.fromParam("workspaceId"),
    async (c) => {
      const [row] = await db
        .select({ archivedAt: workspaceTable.archivedAt })
        .from(workspaceTable)
        .where(eq(workspaceTable.id, c.get("workspaceId")))
        .limit(1);
      const archivedAt = row?.archivedAt?.toISOString() ?? null;
      return c.json({ archived: archivedAt !== null, archivedAt });
    },
  )
  .get(
    "/:workspaceId/members",
    describeRoute({
      operationId: "getWorkspaceMembers",
      tags: ["Workspaces"],
      description: "Get all members of a workspace",
      responses: {
        200: {
          description: "List of workspace members",
          content: {
            "application/json": {
              schema: resolver(
                v.array(
                  v.object({
                    id: v.string(),
                    name: v.string(),
                    email: v.string(),
                    image: v.nullable(v.string()),
                    role: v.string(),
                  }),
                ),
              ),
            },
          },
        },
      },
    }),
    validator("param", v.object({ workspaceId: v.string() })),
    workspaceAccess.fromParam("workspaceId"),
    async (c) => {
      const workspaceId = c.get("workspaceId");
      const members = await getWorkspaceMembersCtrl(workspaceId);
      return c.json(members);
    },
  )
  .get(
    "/:workspaceId/user-directory",
    describeRoute({
      operationId: "searchWorkspaceUserDirectory",
      tags: ["Workspaces"],
      description:
        "Search registered users who are not already members of this workspace (for invites)",
      responses: {
        200: {
          description: "Matching users",
          content: {
            "application/json": {
              schema: resolver(v.array(directoryUserSchema)),
            },
          },
        },
      },
    }),
    validator("param", v.object({ workspaceId: v.string() })),
    validator(
      "query",
      v.object({
        q: v.optional(v.string()),
      }),
    ),
    workspaceAccess.fromParam("workspaceId"),
    requireWorkspacePermission({ invitation: ["create"] }),
    async (c) => {
      const workspaceId = c.get("workspaceId");
      const { q } = c.req.valid("query");
      const users = await searchUserDirectory(workspaceId, q ?? "");
      return c.json(users);
    },
  );

export default workspace;
