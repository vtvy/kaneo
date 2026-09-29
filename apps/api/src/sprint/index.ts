import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import { projectPermission } from "../project-rbac/require-project-permission";
import { dateStringSchema, sprintSchema, taskSchema } from "../schemas";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import assignTaskToSprint from "./controllers/assign-task-to-sprint";
import completeSprint from "./controllers/complete-sprint";
import createSprint from "./controllers/create-sprint";
import deleteSprint from "./controllers/delete-sprint";
import getBacklogTasks from "./controllers/get-backlog-tasks";
import getSprint from "./controllers/get-sprint";
import getSprintTasks from "./controllers/get-sprint-tasks";
import getSprintsByProject from "./controllers/get-sprints-by-project";
import removeTaskFromSprint from "./controllers/remove-task-from-sprint";
import updateSprint from "./controllers/update-sprint";

const sprint = new Hono<{
  Variables: {
    userId: string;
  };
}>()
  .get(
    "/project/:projectId",
    describeRoute({
      operationId: "listSprints",
      tags: ["Sprints"],
      description: "Get all sprints for a specific project",
      responses: {
        200: {
          description: "List of sprints in the project",
          content: {
            "application/json": { schema: resolver(v.array(sprintSchema)) },
          },
        },
      },
    }),
    validator("param", v.object({ projectId: v.string() })),
    workspaceAccess.fromProject("projectId"),
    projectPermission.fromParam({ item: ["read"] }, "projectId"),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const sprints = await getSprintsByProject(projectId);
      return c.json(sprints);
    },
  )
  .get(
    "/project/:projectId/backlog",
    describeRoute({
      operationId: "getBacklogTasks",
      tags: ["Sprints"],
      description: "Get all backlog tasks (sprintId is null) for a project",
      responses: {
        200: {
          description: "List of backlog tasks",
          content: {
            "application/json": { schema: resolver(v.array(taskSchema)) },
          },
        },
      },
    }),
    validator("param", v.object({ projectId: v.string() })),
    workspaceAccess.fromProject("projectId"),
    projectPermission.fromParam({ backlog: ["read"] }, "projectId"),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const tasks = await getBacklogTasks(projectId);
      return c.json(tasks);
    },
  )
  .post(
    "/",
    describeRoute({
      operationId: "createSprint",
      tags: ["Sprints"],
      description: "Create a new sprint in a project",
      responses: {
        200: {
          description: "Sprint created successfully",
          content: {
            "application/json": { schema: resolver(sprintSchema) },
          },
        },
      },
    }),
    validator(
      "json",
      v.object({
        projectId: v.string(),
        name: v.string(),
        goal: v.optional(v.string()),
        startDate: v.optional(dateStringSchema),
        endDate: v.optional(dateStringSchema),
      }),
    ),
    workspaceAccess.fromProject("projectId"),
    projectPermission.fromBody({ sprint: ["manage"] }),
    async (c) => {
      const { projectId, name, goal, startDate, endDate } = c.req.valid("json");
      const currentUserId = c.get("userId");

      const newSprint = await createSprint({
        projectId,
        name,
        goal,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        currentUserId,
      });

      return c.json(newSprint);
    },
  )
  .get(
    "/:id",
    describeRoute({
      operationId: "getSprint",
      tags: ["Sprints"],
      description: "Get a specific sprint by ID",
      responses: {
        200: {
          description: "Sprint details",
          content: {
            "application/json": { schema: resolver(sprintSchema) },
          },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    workspaceAccess.fromSprint(),
    async (c) => {
      const { id } = c.req.valid("param");
      const result = await getSprint(id);
      return c.json(result);
    },
  )
  .get(
    "/:id/tasks",
    describeRoute({
      operationId: "getSprintTasks",
      tags: ["Sprints"],
      description: "Get all tasks assigned to a specific sprint",
      responses: {
        200: {
          description: "List of tasks in the sprint",
          content: {
            "application/json": { schema: resolver(v.array(taskSchema)) },
          },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    workspaceAccess.fromSprint(),
    async (c) => {
      const { id } = c.req.valid("param");
      const tasks = await getSprintTasks(id);
      return c.json(tasks);
    },
  )
  .post(
    "/:id/complete",
    describeRoute({
      operationId: "completeSprint",
      tags: ["Sprints"],
      description: "Complete a sprint and carry over unfinished tasks",
      responses: {
        200: {
          description: "Sprint completed successfully",
          content: {
            "application/json": { schema: resolver(sprintSchema) },
          },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    validator(
      "json",
      v.optional(
        v.object({
          targetSprintId: v.optional(v.nullable(v.string())),
        }),
      ),
    ),
    workspaceAccess.fromSprint(),
    projectPermission.fromSprint({ sprint: ["complete"] }),
    async (c) => {
      const { id } = c.req.valid("param");
      const body = c.req.valid("json") || {};
      const currentUserId = c.get("userId");

      const result = await completeSprint({
        id,
        targetSprintId: body.targetSprintId ?? null,
        currentUserId,
      });
      return c.json(result);
    },
  )
  .post(
    "/:id/task",
    describeRoute({
      operationId: "assignTaskToSprint",
      tags: ["Sprints"],
      description: "Assign a task to a sprint",
      responses: {
        200: {
          description: "Task assigned to sprint successfully",
          content: {
            "application/json": { schema: resolver(taskSchema) },
          },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    validator("json", v.object({ taskId: v.string() })),
    workspaceAccess.fromSprint(),
    projectPermission.fromSprint({ item: ["update"] }),
    async (c) => {
      const { id } = c.req.valid("param");
      const { taskId } = c.req.valid("json");
      const currentUserId = c.get("userId");

      const task = await assignTaskToSprint({ id, taskId, currentUserId });
      return c.json(task);
    },
  )
  .delete(
    "/:id/task",
    describeRoute({
      operationId: "removeTaskFromSprint",
      tags: ["Sprints"],
      description: "Remove a task from a sprint (back to backlog)",
      responses: {
        200: {
          description: "Task removed from sprint successfully",
          content: {
            "application/json": { schema: resolver(taskSchema) },
          },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    validator("json", v.object({ taskId: v.string() })),
    workspaceAccess.fromSprint(),
    projectPermission.fromSprint({ item: ["update"] }),
    async (c) => {
      const { taskId } = c.req.valid("json");
      const currentUserId = c.get("userId");

      const task = await removeTaskFromSprint({ taskId, currentUserId });
      return c.json(task);
    },
  )
  .put(
    "/:id",
    describeRoute({
      operationId: "updateSprint",
      tags: ["Sprints"],
      description: "Update an existing sprint",
      responses: {
        200: {
          description: "Sprint updated successfully",
          content: {
            "application/json": { schema: resolver(sprintSchema) },
          },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    validator(
      "json",
      v.object({
        name: v.optional(v.string()),
        goal: v.optional(v.nullable(v.string())),
        startDate: v.optional(v.nullable(dateStringSchema)),
        endDate: v.optional(v.nullable(dateStringSchema)),
      }),
    ),
    workspaceAccess.fromSprint(),
    projectPermission.fromSprint({ sprint: ["manage"] }),
    async (c) => {
      const { id } = c.req.valid("param");
      const { name, goal, startDate, endDate } = c.req.valid("json");

      const result = await updateSprint({
        id,
        name,
        goal,
        startDate:
          startDate === undefined
            ? undefined
            : startDate === null
              ? null
              : new Date(startDate),
        endDate:
          endDate === undefined
            ? undefined
            : endDate === null
              ? null
              : new Date(endDate),
      });
      return c.json(result);
    },
  )
  .delete(
    "/:id",
    describeRoute({
      operationId: "deleteSprint",
      tags: ["Sprints"],
      description: "Delete a sprint by ID",
      responses: {
        200: {
          description: "Sprint deleted successfully",
          content: {
            "application/json": { schema: resolver(sprintSchema) },
          },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    workspaceAccess.fromSprint(),
    projectPermission.fromSprint({ sprint: ["manage"] }),
    async (c) => {
      const { id } = c.req.valid("param");
      const result = await deleteSprint(id);
      return c.json(result);
    },
  );

export default sprint;
