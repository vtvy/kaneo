import { and, asc, eq, getTableColumns, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { validator } from "hono-openapi";
import * as v from "valibot";
import db from "../database";
import {
  columnTable,
  projectTable,
  sprintTable,
  taskTable,
  userTable,
} from "../database/schema";
import { publishEvent } from "../events";
import { projectPermission } from "../project-rbac/require-project-permission";
import syncTaskSprintMembership from "../sprint/controllers/sync-task-sprint-membership";
import createTask from "../task/controllers/create-task";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { validateHierarchy, WORK_ITEM_TYPES } from "./hierarchy";

const workItems = new Hono<{
  Variables: { userId: string; workspaceId: string };
}>()
  .get(
    "/:projectId",
    workspaceAccess.fromProject("projectId"),
    projectPermission.fromParam({ item: ["read"] }, "projectId"),
    async (c) => {
      const items = await db
        .select({ ...getTableColumns(taskTable), assigneeName: userTable.name })
        .from(taskTable)
        .leftJoin(userTable, eq(taskTable.userId, userTable.id))
        .where(eq(taskTable.projectId, c.req.param("projectId") ?? ""))
        .orderBy(asc(taskTable.backlogRank), asc(taskTable.number));
      return c.json(items);
    },
  )
  .post(
    "/:projectId",
    validator(
      "json",
      v.object({
        title: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(1000)),
        type: v.picklist(WORK_ITEM_TYPES),
        parentId: v.nullable(v.string()),
        sprintId: v.optional(v.nullable(v.string())),
      }),
    ),
    workspaceAccess.fromProject("projectId"),
    projectPermission.fromParam({ item: ["create"] }, "projectId"),
    async (c) => {
      const input = c.req.valid("json");
      const projectId = c.req.param("projectId");
      const items = await db
        .select()
        .from(taskTable)
        .where(eq(taskTable.projectId, projectId));
      const error = validateHierarchy(items, { ...input, id: "new" });
      if (error) throw new HTTPException(400, { message: error });
      const targetSprintId =
        input.sprintId !== undefined
          ? input.sprintId
          : items.find((parent) => parent.id === input.parentId)?.sprintId;
      if (targetSprintId) {
        const [targetSprint] = await db
          .select()
          .from(sprintTable)
          .where(
            and(
              eq(sprintTable.id, targetSprintId),
              eq(sprintTable.projectId, projectId),
            ),
          );
        if (!targetSprint || targetSprint.state === "completed")
          throw new HTTPException(400, {
            message: "Select an open sprint in this project",
          });
      }
      const [firstColumn] = await db
        .select()
        .from(columnTable)
        .where(eq(columnTable.projectId, projectId))
        .orderBy(asc(columnTable.position))
        .limit(1);
      // Reuse creation, notifications, numbering and custom-field defaults.
      const item = await createTask({
        projectId,
        currentUserId: c.get("userId"),
        title: input.title,
        status: firstColumn?.slug,
        workItemType: input.type,
        parentId: input.parentId,
        sprintId: targetSprintId,
      });
      return c.json(item);
    },
  )
  .patch(
    "/:projectId/:id",
    validator(
      "json",
      v.object({
        move: v.optional(v.picklist(["up", "down"])),
        type: v.optional(v.picklist(WORK_ITEM_TYPES)),
        parentId: v.optional(v.nullable(v.string())),
        sprintId: v.optional(v.nullable(v.string())),
        position: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
      }),
    ),
    workspaceAccess.fromProject("projectId"),
    projectPermission.fromParam({ item: ["update"] }, "projectId"),
    async (c) => {
      const projectId = c.req.param("projectId");
      const id = c.req.param("id");
      const input = c.req.valid("json");
      if (Object.keys(input).length === 0)
        throw new HTTPException(400, {
          message: "No work item changes provided",
        });
      const updated = await db.transaction(async (tx) => {
        // Serialize changes to a project's hierarchy to prevent concurrent reparent races.
        await tx
          .select({ id: projectTable.id })
          .from(projectTable)
          .where(eq(projectTable.id, projectId))
          .for("update");
        const items = await tx
          .select()
          .from(taskTable)
          .where(eq(taskTable.projectId, projectId));
        const item = items.find((entry) => entry.id === id);
        if (!item)
          throw new HTTPException(404, { message: "Work item not found" });
        if (input.move) {
          if (Object.keys(input).length !== 1)
            throw new HTTPException(400, {
              message: "Reorder separately from other changes",
            });
          const siblings = items
            .filter((candidate) => candidate.parentId === item.parentId)
            .sort(
              (a, b) =>
                a.backlogRank - b.backlogRank ||
                (a.number ?? 0) - (b.number ?? 0),
            );
          const index = siblings.findIndex(
            (candidate) => candidate.id === item.id,
          );
          const target = index + (input.move === "up" ? -1 : 1);
          if (target >= 0 && target < siblings.length) {
            const other = siblings[target];
            if (other) {
              siblings[target] = item;
              siblings[index] = other;
            }
          }
          for (const [rank, candidate] of siblings.entries())
            await tx
              .update(taskTable)
              .set({ backlogRank: rank })
              .where(eq(taskTable.id, candidate.id));
          return {
            ...item,
            backlogRank: siblings.findIndex(
              (candidate) => candidate.id === item.id,
            ),
          };
        }
        if (input.parentId && input.sprintId === undefined)
          input.sprintId =
            items.find((parent) => parent.id === input.parentId)?.sprintId ??
            null;
        const next = { ...item, ...input };
        const error = validateHierarchy(items, next);
        if (error) throw new HTTPException(400, { message: error });
        if (input.sprintId) {
          const [sprint] = await tx
            .select()
            .from(sprintTable)
            .where(
              and(
                eq(sprintTable.id, input.sprintId),
                eq(sprintTable.projectId, projectId),
              ),
            );
          if (!sprint || sprint.state === "completed")
            throw new HTTPException(400, {
              message: "Select an open sprint in this project",
            });
        }

        const changed = await tx
          .update(taskTable)
          .set(input)
          .where(and(eq(taskTable.id, id), eq(taskTable.projectId, projectId)))
          .returning();
        if (input.sprintId !== undefined) {
          const ids = new Set([id]);
          for (let pass = 0; pass < items.length; pass++) {
            const before = ids.size;
            for (const child of items)
              if (child.parentId && ids.has(child.parentId)) ids.add(child.id);
            if (ids.size === before) break;
          }
          await tx
            .update(taskTable)
            .set({ sprintId: input.sprintId })
            .where(inArray(taskTable.id, [...ids]));
          for (const childId of ids)
            await syncTaskSprintMembership(childId, input.sprintId, tx);
        }
        return changed[0];
      });
      await publishEvent("task.updated", {
        taskId: id,
        projectId,
        userId: c.get("userId"),
      });
      return c.json(updated);
    },
  );
export default workItems;
