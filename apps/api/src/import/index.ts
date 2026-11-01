import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { describeRoute, resolver, validator } from "hono-openapi";
import type * as v from "valibot";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import getImportRun from "./controllers/get-import-run";
import listImportRuns from "./controllers/list-import-runs";
import listSourceProjects from "./controllers/list-source-projects";
import startImportRun from "./controllers/start-import-run";
import {
  importRunEnvelopeSchema,
  importRunListSchema,
  importSourceProjectListSchema,
} from "./response";
import {
  importRunParam,
  listImportSourceProjectsBody,
  startImportRunBody,
  workspaceIdParam,
} from "./schema";

// Creating projects from another tool needs both rights, as upstream does.
const importPermission = requireWorkspacePermission({
  workspace: ["manage_settings"],
  project: ["create"],
});

const jsonContent = (schema: v.GenericSchema) => ({
  "application/json": { schema: resolver(schema) },
});

// The request body carries source credentials, so a validation failure
// answers with the first message only, never the submitted body.
function rejectInvalid(result: {
  success: boolean;
  error?: readonly { message: string }[];
}) {
  if (!result.success) {
    throw new HTTPException(400, {
      message: result.error?.[0]?.message ?? "Invalid request body",
    });
  }
}

const importRoutes = new Hono<{
  Variables: { userId: string; workspaceId: string };
}>()
  .post(
    "/projects",
    describeRoute({
      operationId: "listImportSourceProjects",
      tags: ["Import"],
      description:
        "Sign in to PLANKA or Jira and list the projects that can be imported. The credentials are used only for this request; they are never stored, logged, or returned.",
      responses: {
        200: {
          description: "Projects available in the source",
          content: jsonContent(importSourceProjectListSchema),
        },
        400: {
          description:
            "Invalid body, credentials the source rejected, or a destination this server may not reach",
        },
        403: {
          description:
            "Missing workspace:manage_settings or project:create permission",
        },
        502: {
          description:
            "The source could not be reached or answered with an error",
        },
      },
    }),
    validator("json", listImportSourceProjectsBody, rejectInvalid),
    workspaceAccess.fromBody(),
    importPermission,
    async (c) => {
      const { connection } = c.req.valid("json");
      c.header("Cache-Control", "no-store");
      return c.json(await listSourceProjects(connection));
    },
  )
  .post(
    "/runs",
    describeRoute({
      operationId: "startImportRun",
      tags: ["Import"],
      description:
        "Import the selected source projects into the workspace as new projects. The import runs in the background; poll getImportRun for progress. Credentials are held in memory only while the import runs; they are never stored, logged, or returned.",
      responses: {
        202: {
          description: "The import started",
          content: jsonContent(importRunEnvelopeSchema),
        },
        400: {
          description:
            "Invalid body, rejected credentials, a blocked destination, or a selected project the source no longer lists",
        },
        403: {
          description:
            "Missing workspace:manage_settings or project:create permission",
        },
        409: {
          description: "Another import is already running in this workspace",
        },
        429: {
          description:
            "This server is already running its maximum number of imports",
        },
        502: {
          description:
            "The source could not be reached or answered with an error",
        },
        503: {
          description: "The server is restarting and not starting new imports",
        },
      },
    }),
    validator("json", startImportRunBody, rejectInvalid),
    workspaceAccess.fromBody(),
    importPermission,
    async (c) => {
      const { connection, projectIds, includeComments } = c.req.valid("json");
      const run = await startImportRun({
        workspaceId: c.get("workspaceId"),
        userId: c.get("userId"),
        connection,
        projectIds,
        includeComments,
      });
      return c.json({ run }, 202);
    },
  )
  .get(
    "/runs/:workspaceId",
    describeRoute({
      operationId: "listImportRuns",
      tags: ["Import"],
      description:
        "The workspace's 20 most recent imports, newest first. A run whose server stopped reporting progress is returned as failed.",
      responses: {
        200: {
          description: "Recent imports",
          content: jsonContent(importRunListSchema),
        },
      },
    }),
    validator("param", workspaceIdParam),
    workspaceAccess.fromParam("workspaceId"),
    importPermission,
    async (c) => c.json(await listImportRuns(c.get("workspaceId"))),
  )
  .get(
    "/runs/:workspaceId/:runId",
    describeRoute({
      operationId: "getImportRun",
      tags: ["Import"],
      description:
        "Progress and outcome of one import, including each project's status, counts and warnings.",
      responses: {
        200: {
          description: "The import",
          content: jsonContent(importRunEnvelopeSchema),
        },
        404: { description: "Import not found" },
      },
    }),
    validator("param", importRunParam),
    workspaceAccess.fromParam("workspaceId"),
    importPermission,
    async (c) => {
      const { runId } = c.req.valid("param");
      return c.json(await getImportRun(c.get("workspaceId"), runId));
    },
  );

export default importRoutes;
