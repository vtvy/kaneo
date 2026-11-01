import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import db from "../database";
import { externalLinkTable } from "../database/schema";
import { projectPermission } from "../project-rbac/require-project-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import createExternalLink from "./controllers/create-external-link";
import deleteExternalLink from "./controllers/delete-external-link";
import { isHttpUrl } from "./http-url";

const externalLinkSchema = v.object({
  id: v.string(),
  taskId: v.string(),
  integrationId: v.nullable(v.string()),
  resourceType: v.string(),
  externalId: v.string(),
  url: v.string(),
  title: v.nullable(v.string()),
  metadata: v.any(),
  createdAt: v.date(),
  updatedAt: v.date(),
});

const createBody = v.object({
  url: v.pipe(v.string(), v.check(isHttpUrl, "URL must use http or https")),
  title: v.optional(v.pipe(v.string(), v.maxLength(200))),
});

const externalLink = new Hono<{
  Variables: {
    userId: string;
    workspaceId: string;
  };
}>()
  .post(
    "/task/:taskId",
    describeRoute({
      operationId: "createExternalLink",
      tags: ["External Links"],
      description: "Add an http or https resource link to a task",
      responses: {
        200: {
          description: "External link created",
          content: {
            "application/json": { schema: resolver(externalLinkSchema) },
          },
        },
      },
    }),
    validator("param", v.object({ taskId: v.string() })),
    validator("json", createBody),
    workspaceAccess.fromTaskId("taskId"),
    projectPermission.fromTask({ item: ["update"] }, "taskId"),
    async (c) => {
      const { taskId } = c.req.valid("param");
      const { url, title } = c.req.valid("json");
      const link = await createExternalLink({
        taskId,
        url,
        title,
        userId: c.get("userId"),
      });
      return c.json({
        ...link,
        metadata: link.metadata ? JSON.parse(link.metadata) : null,
      });
    },
  )
  .delete(
    "/task/:taskId/:id",
    describeRoute({
      operationId: "deleteExternalLink",
      tags: ["External Links"],
      description:
        "Remove a manually added link. Integration-managed links stay.",
      responses: {
        200: {
          description: "Manual resource link removed",
          content: {
            "application/json": {
              schema: resolver(v.object({ id: v.string() })),
            },
          },
        },
      },
    }),
    validator("param", v.object({ taskId: v.string(), id: v.string() })),
    workspaceAccess.fromTaskId("taskId"),
    projectPermission.fromTask({ item: ["update"] }, "taskId"),
    async (c) => {
      const { taskId, id } = c.req.valid("param");
      const deleted = await deleteExternalLink({
        taskId,
        id,
        userId: c.get("userId"),
      });
      return c.json(deleted);
    },
  )
  .get(
    "/task/:taskId",
    describeRoute({
      operationId: "getExternalLinksByTask",
      tags: ["External Links"],
      description:
        "Get manually added resource links and links from connected integrations",
      responses: {
        200: {
          description: "External links for the task",
          content: {
            "application/json": {
              schema: resolver(v.array(externalLinkSchema)),
            },
          },
        },
      },
    }),
    validator("param", v.object({ taskId: v.string() })),
    workspaceAccess.fromTaskId("taskId"),
    async (c) => {
      const { taskId } = c.req.valid("param");

      const links = await db.query.externalLinkTable.findMany({
        where: eq(externalLinkTable.taskId, taskId),
        with: {
          // Never return the integration config: it holds access tokens and
          // webhook secrets.
          integration: { columns: { id: true, type: true } },
        },
      });

      const formattedLinks = links.map((link) => ({
        ...link,
        metadata: link.metadata ? JSON.parse(link.metadata) : null,
      }));

      return c.json(formattedLinks);
    },
  );

export default externalLink;
