import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import { projectPermission } from "../project-rbac/require-project-permission";
import { projectSchema } from "../schemas";
import { isInstanceAdmin } from "../utils/is-instance-admin";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import archiveProjectCtrl from "./controllers/archive-project";
import clearProjectBackground from "./controllers/clear-project-background";
import createProjectCtrl from "./controllers/create-project";
import deleteProjectCtrl from "./controllers/delete-project";
import finalizeProjectBackground from "./controllers/finalize-project-background";
import getProjectCtrl from "./controllers/get-project";
import getProjectBackgroundResponse from "./controllers/get-project-background";
import getProjectsCtrl from "./controllers/get-projects";
import moveProjectCtrl from "./controllers/move-project";
import prepareProjectBackgroundUpload from "./controllers/prepare-project-background-upload";
import unarchiveProjectCtrl from "./controllers/unarchive-project";
import updateProjectCtrl from "./controllers/update-project";
import { toPublicProject } from "./to-public-project";

const project = new Hono<{
  Variables: {
    userId: string;
    workspaceId: string;
  };
}>()
  .get(
    "/",
    describeRoute({
      operationId: "listProjects",
      tags: ["Projects"],
      description: "Get all projects in a workspace",
      responses: {
        200: {
          description: "List of projects with statistics",
          content: {
            "application/json": { schema: resolver(v.array(projectSchema)) },
          },
        },
      },
    }),
    validator(
      "query",
      v.object({
        workspaceId: v.string(),
        includeArchived: v.optional(v.string()),
      }),
    ),
    workspaceAccess.fromQuery(),
    async (c) => {
      const workspaceId = c.get("workspaceId");
      const userId = c.get("userId");
      const { includeArchived } = c.req.valid("query");
      const projects = await getProjectsCtrl(
        workspaceId,
        userId,
        includeArchived === "true",
      );
      return c.json(projects.map(toPublicProject));
    },
  )
  .post(
    "/",
    describeRoute({
      operationId: "createProject",
      tags: ["Projects"],
      description: "Create a new project in a workspace",
      responses: {
        200: {
          description: "Project created successfully",
          content: {
            "application/json": { schema: resolver(projectSchema) },
          },
        },
      },
    }),
    validator(
      "json",
      v.object({
        name: v.string(),
        workspaceId: v.string(),
        icon: v.string(),
        slug: v.string(),
      }),
    ),
    workspaceAccess.fromBody(),
    requireWorkspacePermission({ project: ["create"] }),
    async (c) => {
      const { name, icon, slug } = c.req.valid("json");
      const workspaceId = c.get("workspaceId");
      const userId = c.get("userId");
      const newProject = await createProjectCtrl(
        workspaceId,
        name,
        icon,
        slug,
        userId,
      );
      return c.json(toPublicProject(newProject));
    },
  )
  .get(
    "/:id",
    describeRoute({
      operationId: "getProject",
      tags: ["Projects"],
      description: "Get a specific project by ID",
      responses: {
        200: {
          description: "Project details",
          content: {
            "application/json": { schema: resolver(projectSchema) },
          },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    workspaceAccess.fromProject(),
    projectPermission.fromParam({ item: ["read"] }, "id"),
    async (c) => {
      const { id } = c.req.valid("param");
      const workspaceId = c.get("workspaceId");
      const projectData = await getProjectCtrl(id, workspaceId);
      return c.json(toPublicProject(projectData));
    },
  )
  .put(
    "/:id",
    describeRoute({
      operationId: "updateProject",
      tags: ["Projects"],
      description: "Update an existing project",
      responses: {
        200: {
          description: "Project updated successfully",
          content: {
            "application/json": { schema: resolver(projectSchema) },
          },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    validator(
      "json",
      v.object({
        name: v.string(),
        icon: v.string(),
        slug: v.string(),
        description: v.string(),
        isPublic: v.boolean(),
        sprintCycleWeeks: v.optional(
          v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(8)),
        ),
      }),
    ),
    workspaceAccess.fromProject(),
    projectPermission.fromParam({ role: ["manage"] }, "id"),
    async (c) => {
      const { id } = c.req.valid("param");
      const { name, icon, slug, description, isPublic, sprintCycleWeeks } =
        c.req.valid("json");
      const workspaceId = c.get("workspaceId");
      const updatedProject = await updateProjectCtrl(
        id,
        name,
        icon,
        slug,
        description,
        isPublic,
        workspaceId,
        sprintCycleWeeks,
      );
      return c.json(toPublicProject(updatedProject));
    },
  )
  .delete(
    "/:id",
    describeRoute({
      operationId: "deleteProject",
      tags: ["Projects"],
      description: "Delete a project by ID",
      responses: {
        200: {
          description: "Project deleted successfully",
          content: {
            "application/json": { schema: resolver(projectSchema) },
          },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    workspaceAccess.fromProject(),
    projectPermission.fromParam({ role: ["manage"] }, "id"),
    async (c) => {
      const { id } = c.req.valid("param");
      const workspaceId = c.get("workspaceId");
      const deletedProject = await deleteProjectCtrl(id, workspaceId);
      return c.json(toPublicProject(deletedProject));
    },
  )
  .put(
    "/:id/archive",
    describeRoute({
      operationId: "archiveProject",
      tags: ["Projects"],
      description: "Archive a project by ID",
      responses: {
        200: {
          description: "Project archived successfully",
          content: {
            "application/json": { schema: resolver(projectSchema) },
          },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    workspaceAccess.fromProject(),
    projectPermission.fromParam({ role: ["manage"] }, "id"),
    async (c) => {
      const { id } = c.req.valid("param");
      const workspaceId = c.get("workspaceId");
      const archivedProject = await archiveProjectCtrl(id, workspaceId);
      return c.json(toPublicProject(archivedProject));
    },
  )
  .put(
    "/:id/unarchive",
    describeRoute({
      operationId: "unarchiveProject",
      tags: ["Projects"],
      description: "Unarchive a project by ID",
      responses: {
        200: {
          description: "Project unarchived successfully",
          content: {
            "application/json": { schema: resolver(projectSchema) },
          },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    workspaceAccess.fromProject(),
    projectPermission.fromParam({ role: ["manage"] }, "id"),
    async (c) => {
      const { id } = c.req.valid("param");
      const workspaceId = c.get("workspaceId");
      const unarchivedProject = await unarchiveProjectCtrl(id, workspaceId);
      return c.json(toPublicProject(unarchivedProject));
    },
  )
  .put(
    "/:id/move",
    describeRoute({
      operationId: "moveProject",
      tags: ["Projects"],
      description:
        "Move a project to another workspace. Requires managing the project (project role:manage or workspace owner/admin) and membership plus project creation permission in the target. Project members and assignees outside the target are removed or unassigned, and integrations are deactivated.",
      responses: {
        200: {
          description: "Project moved successfully",
          content: {
            "application/json": { schema: resolver(projectSchema) },
          },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    validator(
      "json",
      v.object({ workspaceId: v.pipe(v.string(), v.minLength(1)) }),
    ),
    workspaceAccess.fromProject(),
    async (c) => {
      const { id } = c.req.valid("param");
      const { workspaceId: targetWorkspaceId } = c.req.valid("json");
      const movedProject = await moveProjectCtrl({
        projectId: id,
        sourceWorkspaceId: c.get("workspaceId"),
        targetWorkspaceId,
        userId: c.get("userId"),
        isInstanceAdmin: await isInstanceAdmin(c),
      });
      return c.json(toPublicProject(movedProject));
    },
  )
  .get(
    "/:id/background",
    describeRoute({
      operationId: "getProjectBackground",
      tags: ["Projects"],
      description: "Download the current project board background image",
    }),
    validator("param", v.object({ id: v.string() })),
    workspaceAccess.fromProject(),
    projectPermission.fromParam({ item: ["read"] }, "id"),
    async (c) => {
      const { id } = c.req.valid("param");
      return getProjectBackgroundResponse(id, c.req.header("If-None-Match"));
    },
  )
  .put(
    "/:id/background-upload",
    describeRoute({
      operationId: "uploadProjectBackground",
      tags: ["Projects"],
      description: "Create a presigned background image upload URL",
      responses: {
        200: {
          description: "Background image upload URL",
          content: {
            "application/json": {
              schema: resolver(
                v.object({
                  key: v.string(),
                  uploadUrl: v.string(),
                  version: v.string(),
                  headers: v.record(v.string(), v.string()),
                }),
              ),
            },
          },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    validator(
      "json",
      v.object({
        contentType: v.string(),
        size: v.number(),
      }),
    ),
    workspaceAccess.fromProject(),
    projectPermission.fromParam({ role: ["manage"] }, "id"),
    async (c) => {
      const { id } = c.req.valid("param");
      const { contentType, size } = c.req.valid("json");
      const upload = await prepareProjectBackgroundUpload(
        id,
        contentType,
        size,
      );
      return c.json(upload);
    },
  )
  .post(
    "/:id/background-upload/finalize",
    describeRoute({
      operationId: "finalizeProjectBackgroundUpload",
      tags: ["Projects"],
      description: "Save an uploaded image as the project board background",
      responses: {
        200: {
          description: "Finalized project background",
          content: {
            "application/json": {
              schema: resolver(v.object({ url: v.string() })),
            },
          },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    validator(
      "json",
      v.object({
        key: v.string(),
        contentType: v.string(),
        version: v.string(),
        size: v.number(),
      }),
    ),
    workspaceAccess.fromProject(),
    projectPermission.fromParam({ role: ["manage"] }, "id"),
    async (c) => {
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const apiBaseUrl = process.env.KANEO_API_URL || new URL(c.req.url).origin;
      const result = await finalizeProjectBackground(id, body, apiBaseUrl);
      return c.json(result);
    },
  )
  .delete(
    "/:id/background",
    describeRoute({
      operationId: "deleteProjectBackground",
      tags: ["Projects"],
      description: "Remove the current project board background image",
    }),
    validator("param", v.object({ id: v.string() })),
    workspaceAccess.fromProject(),
    projectPermission.fromParam({ role: ["manage"] }, "id"),
    async (c) => {
      const { id } = c.req.valid("param");
      await clearProjectBackground(id);
      return c.body(null, 204);
    },
  );

export default project;
