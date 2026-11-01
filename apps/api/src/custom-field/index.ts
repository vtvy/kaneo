import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import { projectPermission } from "../project-rbac/require-project-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import createCustomField from "./controllers/create-custom-field";
import deleteCustomField from "./controllers/delete-custom-field";
import getCustomFieldFilterValues from "./controllers/get-custom-field-filter-values";
import getCustomFieldValuesByProject from "./controllers/get-custom-field-values-by-project";
import getCustomFieldValuesByTask from "./controllers/get-custom-field-values-by-task";
import getCustomFieldsByProject from "./controllers/get-custom-fields-by-project";
import reorderCustomFields from "./controllers/reorder-custom-field";
import setCustomFieldValue from "./controllers/set-custom-field-value";
import updateCustomField from "./controllers/update-custom-field";
import {
  createCustomFieldBody,
  customFieldDefinitionSchema,
  customFieldFilterValuesSchema,
  customFieldValueSchema,
  reorderCustomFieldsBody,
  setCustomFieldValueBody,
  setCustomFieldValueResponseSchema,
  updateCustomFieldBody,
} from "./schema";

const jsonContent = (schema: v.GenericSchema) => ({
  "application/json": { schema: resolver(schema) },
});

// Fields belong to a project. Reading needs item:read, setting a task's value
// needs item:update, and defining fields needs role:manage (project admins).
const customField = new Hono<{
  Variables: {
    userId: string;
  };
}>()
  .get(
    "/project/:projectId",
    describeRoute({
      operationId: "getCustomFieldsByProject",
      tags: ["Custom Fields"],
      description: "Get all custom field definitions for a project",
      responses: {
        200: {
          description: "List of custom field definitions",
          content: jsonContent(v.array(customFieldDefinitionSchema)),
        },
      },
    }),
    validator("param", v.object({ projectId: v.string() })),
    workspaceAccess.fromProject("projectId"),
    projectPermission.fromParam({ item: ["read"] }),
    async (c) => {
      const { projectId } = c.req.valid("param");
      return c.json(await getCustomFieldsByProject(projectId));
    },
  )
  .get(
    "/project/:projectId/values",
    describeRoute({
      operationId: "getCustomFieldValuesByProject",
      tags: ["Custom Fields"],
      description: "Get all custom field values for every task in a project",
      responses: {
        200: {
          description: "List of custom field values for the project",
          content: jsonContent(v.array(customFieldValueSchema)),
        },
      },
    }),
    validator("param", v.object({ projectId: v.string() })),
    workspaceAccess.fromProject("projectId"),
    projectPermission.fromParam({ item: ["read"] }),
    async (c) => {
      const { projectId } = c.req.valid("param");
      return c.json(await getCustomFieldValuesByProject(projectId));
    },
  )
  .get(
    "/project/:projectId/filter-values",
    describeRoute({
      operationId: "getCustomFieldFilterValues",
      tags: ["Custom Fields"],
      description:
        "Get distinct values used by tasks for each custom field of a project",
      responses: {
        200: {
          description: "Distinct values used for each custom field",
          content: jsonContent(v.array(customFieldFilterValuesSchema)),
        },
      },
    }),
    validator("param", v.object({ projectId: v.string() })),
    workspaceAccess.fromProject("projectId"),
    projectPermission.fromParam({ item: ["read"] }),
    async (c) => {
      const { projectId } = c.req.valid("param");
      return c.json(await getCustomFieldFilterValues(projectId));
    },
  )
  .get(
    "/task/:taskId",
    describeRoute({
      operationId: "getCustomFieldValuesByTask",
      tags: ["Custom Fields"],
      description:
        "Get all custom field values for a task with their definitions",
      responses: {
        200: {
          description: "List of custom field values for the task",
          content: jsonContent(v.array(customFieldValueSchema)),
        },
      },
    }),
    validator("param", v.object({ taskId: v.string() })),
    workspaceAccess.fromTaskId(),
    projectPermission.fromTask({ item: ["read"] }, "taskId"),
    async (c) => {
      const { taskId } = c.req.valid("param");
      return c.json(await getCustomFieldValuesByTask(taskId));
    },
  )
  .post(
    "/",
    describeRoute({
      operationId: "createCustomField",
      tags: ["Custom Fields"],
      description: "Create a custom field definition for a project",
      responses: {
        200: {
          description: "The created custom field",
          content: jsonContent(customFieldDefinitionSchema),
        },
      },
    }),
    validator("json", createCustomFieldBody),
    workspaceAccess.fromProject("projectId"),
    projectPermission.fromBody({ role: ["manage"] }),
    async (c) => {
      const { projectId, name, type, required, defaultValue, options } =
        c.req.valid("json");
      return c.json(
        await createCustomField(
          projectId,
          name,
          type,
          required,
          defaultValue,
          options,
        ),
      );
    },
  )
  .put(
    "/reorder/:projectId",
    describeRoute({
      operationId: "reorderCustomFields",
      tags: ["Custom Fields"],
      description: "Set new positions for a project's custom fields",
      responses: {
        200: {
          description: "The reordered custom fields",
          content: jsonContent(v.array(customFieldDefinitionSchema)),
        },
      },
    }),
    validator("param", v.object({ projectId: v.string() })),
    validator("json", reorderCustomFieldsBody),
    workspaceAccess.fromProject("projectId"),
    projectPermission.fromParam({ role: ["manage"] }),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const { fields } = c.req.valid("json");
      return c.json(await reorderCustomFields(projectId, fields));
    },
  )
  .put(
    "/value",
    describeRoute({
      operationId: "setCustomFieldValue",
      tags: ["Custom Fields"],
      description: "Create or update a custom field value for a task",
      responses: {
        200: {
          description: "The saved custom field value",
          content: jsonContent(setCustomFieldValueResponseSchema),
        },
      },
    }),
    validator("json", setCustomFieldValueBody),
    workspaceAccess.fromTaskId(),
    projectPermission.fromTaskInBody({ item: ["update"] }, "taskId"),
    async (c) => {
      const { taskId, fieldId, value } = c.req.valid("json");
      return c.json(await setCustomFieldValue(taskId, fieldId, value));
    },
  )
  .put(
    "/:id",
    describeRoute({
      operationId: "updateCustomField",
      tags: ["Custom Fields"],
      description:
        "Update a custom field's name, required flag, default, or options. The type can't change, except between dropdown and multiselect. Options that tasks still use can't be removed or renamed; hide them instead.",
      responses: {
        200: {
          description: "The updated custom field",
          content: jsonContent(customFieldDefinitionSchema),
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    validator("json", updateCustomFieldBody),
    workspaceAccess.fromCustomField(),
    projectPermission.fromCustomField({ role: ["manage"] }),
    async (c) => {
      const { id } = c.req.valid("param");
      return c.json(await updateCustomField(id, c.req.valid("json")));
    },
  )
  .delete(
    "/:id",
    describeRoute({
      operationId: "deleteCustomField",
      tags: ["Custom Fields"],
      description: "Delete a custom field definition by ID",
      responses: {
        200: {
          description: "The deleted custom field",
          content: jsonContent(customFieldDefinitionSchema),
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    workspaceAccess.fromCustomField(),
    projectPermission.fromCustomField({ role: ["manage"] }),
    async (c) => {
      const { id } = c.req.valid("param");
      return c.json(await deleteCustomField(id));
    },
  );

export default customField;
