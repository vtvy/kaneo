import { eq } from "drizzle-orm";
import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../database";
import { isInstanceAdmin } from "../utils/is-instance-admin";
import { canInProjectAll } from "./can-in-project";
import type { ProjectPermissionMap } from "./catalog";

type ProjectIdResolver = (
  c: Context,
) => string | undefined | Promise<string | undefined>;

export function requireProjectPermission(
  permissions: ProjectPermissionMap,
  getProjectId: ProjectIdResolver,
) {
  return async (c: Context, next: Next) => {
    if (await isInstanceAdmin(c)) return next();

    const userId = c.get("userId");
    if (!userId) throw new HTTPException(401, { message: "Unauthorized" });

    const projectId = await getProjectId(c);
    if (!projectId)
      throw new HTTPException(400, {
        message: "projectId could not be determined",
      });

    if (!(await canInProjectAll(userId, projectId, permissions))) {
      throw new HTTPException(403, { message: "Insufficient permissions" });
    }
    return next();
  };
}

async function projectIdFromTask(id: string): Promise<string | undefined> {
  const [row] = await db
    .select({ projectId: schema.taskTable.projectId })
    .from(schema.taskTable)
    .where(eq(schema.taskTable.id, id))
    .limit(1);
  return row?.projectId;
}

async function projectIdFromColumn(id: string): Promise<string | undefined> {
  const [row] = await db
    .select({ projectId: schema.columnTable.projectId })
    .from(schema.columnTable)
    .where(eq(schema.columnTable.id, id))
    .limit(1);
  return row?.projectId;
}

async function projectIdFromSprint(id: string): Promise<string | undefined> {
  const [row] = await db
    .select({ projectId: schema.sprintTable.projectId })
    .from(schema.sprintTable)
    .where(eq(schema.sprintTable.id, id))
    .limit(1);
  return row?.projectId;
}

async function projectIdFromFolder(id: string): Promise<string | undefined> {
  const [row] = await db
    .select({ projectId: schema.folderTable.projectId })
    .from(schema.folderTable)
    .where(eq(schema.folderTable.id, id))
    .limit(1);
  return row?.projectId;
}

async function projectIdFromDocument(id: string): Promise<string | undefined> {
  const [row] = await db
    .select({ projectId: schema.documentTable.projectId })
    .from(schema.documentTable)
    .where(eq(schema.documentTable.id, id))
    .limit(1);
  return row?.projectId;
}

async function projectIdFromTaskRelation(
  id: string,
): Promise<string | undefined> {
  const [rel] = await db
    .select({ sourceTaskId: schema.taskRelationTable.sourceTaskId })
    .from(schema.taskRelationTable)
    .where(eq(schema.taskRelationTable.id, id))
    .limit(1);
  return rel ? projectIdFromTask(rel.sourceTaskId) : undefined;
}

async function projectIdFromComment(id: string): Promise<string | undefined> {
  const [row] = await db
    .select({ taskId: schema.commentTable.taskId })
    .from(schema.commentTable)
    .where(eq(schema.commentTable.id, id))
    .limit(1);
  return row?.taskId ? projectIdFromTask(row.taskId) : undefined;
}

export const projectPermission = {
  fromParam: (perms: ProjectPermissionMap, key = "projectId") =>
    requireProjectPermission(perms, (c) => c.req.param(key)),

  fromBody: (perms: ProjectPermissionMap, key = "projectId") =>
    requireProjectPermission(perms, async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      return typeof body[key] === "string" ? (body[key] as string) : undefined;
    }),

  fromTask: (perms: ProjectPermissionMap, key = "id") =>
    requireProjectPermission(perms, (c) => {
      const id = c.req.param(key);
      return id ? projectIdFromTask(id) : undefined;
    }),

  fromColumn: (perms: ProjectPermissionMap, key = "id") =>
    requireProjectPermission(perms, (c) => {
      const id = c.req.param(key);
      return id ? projectIdFromColumn(id) : undefined;
    }),

  fromSprint: (perms: ProjectPermissionMap, key = "id") =>
    requireProjectPermission(perms, (c) => {
      const id = c.req.param(key);
      return id ? projectIdFromSprint(id) : undefined;
    }),

  fromFolder: (perms: ProjectPermissionMap, key = "id") =>
    requireProjectPermission(perms, (c) => {
      const id = c.req.param(key);
      return id ? projectIdFromFolder(id) : undefined;
    }),

  fromDocument: (perms: ProjectPermissionMap, key = "id") =>
    requireProjectPermission(perms, (c) => {
      const id = c.req.param(key);
      return id ? projectIdFromDocument(id) : undefined;
    }),

  fromTaskInBody: (perms: ProjectPermissionMap, key = "sourceTaskId") =>
    requireProjectPermission(perms, async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      const taskId = typeof body[key] === "string" ? body[key] : undefined;
      return taskId ? projectIdFromTask(taskId) : undefined;
    }),

  fromTaskRelation: (perms: ProjectPermissionMap, key = "id") =>
    requireProjectPermission(perms, (c) => {
      const id = c.req.param(key);
      return id ? projectIdFromTaskRelation(id) : undefined;
    }),

  fromComment: (perms: ProjectPermissionMap, key = "id") =>
    requireProjectPermission(perms, (c) => {
      const id = c.req.param(key);
      return id ? projectIdFromComment(id) : undefined;
    }),
};
