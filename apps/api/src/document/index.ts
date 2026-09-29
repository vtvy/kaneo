import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import { projectPermission } from "../project-rbac/require-project-permission";
import { storage } from "../storage";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import createFolder from "./controllers/create-folder";
import emptyTrash from "./controllers/empty-trash";
import getDocument from "./controllers/get-document";
import getFolders from "./controllers/get-folders";
import listDocuments from "./controllers/list-documents";
import listTrash from "./controllers/list-trash";
import purgeDocument from "./controllers/purge-document";
import purgeFolder from "./controllers/purge-folder";
import restoreDocument from "./controllers/restore-document";
import restoreFolder from "./controllers/restore-folder";
import trashDocument from "./controllers/trash-document";
import trashFolder from "./controllers/trash-folder";
import updateDocument from "./controllers/update-document";
import updateFolder from "./controllers/update-folder";
import uploadDocument from "./controllers/upload-document";

// Builds a safe `attachment` Content-Disposition with both an ASCII fallback
// and a UTF-8 encoded form for non-ASCII filenames.
function contentDisposition(filename: string) {
  const normalized = filename
    .normalize("NFC")
    .replace(/[\r\n"]/g, "")
    .trim();
  const safe = normalized || "file";
  const asciiFallback =
    safe
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[\\/]/g, "-")
      .replace(/[^\x20-\x7E]+/g, "_")
      .trim() || "file";
  const encoded = encodeURIComponent(safe).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

const document = new Hono<{
  Variables: {
    userId: string;
  };
}>()
  // ── Folders ──────────────────────────────────────────────────────────────
  .get(
    "/folders/:projectId",
    describeRoute({
      operationId: "getFolders",
      tags: ["Documents"],
      description: "List all folders in a project",
      responses: {
        200: {
          description: "Folders for the project",
          content: { "application/json": { schema: resolver(v.any()) } },
        },
      },
    }),
    validator("param", v.object({ projectId: v.string() })),
    workspaceAccess.fromProject("projectId"),
    projectPermission.fromParam({ doc: ["view"] }, "projectId"),
    async (c) => {
      const { projectId } = c.req.valid("param");
      return c.json(await getFolders(projectId));
    },
  )
  .post(
    "/folders/:projectId",
    describeRoute({
      operationId: "createFolder",
      tags: ["Documents"],
      description: "Create a folder in a project",
      responses: {
        200: {
          description: "Folder created",
          content: { "application/json": { schema: resolver(v.any()) } },
        },
      },
    }),
    validator("param", v.object({ projectId: v.string() })),
    validator(
      "json",
      v.object({
        name: v.string(),
        parentId: v.optional(v.nullable(v.string())),
      }),
    ),
    workspaceAccess.fromProject("projectId"),
    projectPermission.fromParam({ doc: ["manage"] }, "projectId"),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const { name, parentId } = c.req.valid("json");
      const currentUserId = c.get("userId");
      return c.json(
        await createFolder({ projectId, name, parentId, currentUserId }),
      );
    },
  )
  .put(
    "/folders/:id",
    describeRoute({
      operationId: "updateFolder",
      tags: ["Documents"],
      description: "Rename or move a folder",
      responses: {
        200: {
          description: "Folder updated",
          content: { "application/json": { schema: resolver(v.any()) } },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    validator(
      "json",
      v.object({
        name: v.optional(v.string()),
        parentId: v.optional(v.nullable(v.string())),
      }),
    ),
    workspaceAccess.fromFolder("id"),
    projectPermission.fromFolder({ doc: ["manage"] }),
    async (c) => {
      const { id } = c.req.valid("param");
      const { name, parentId } = c.req.valid("json");
      return c.json(await updateFolder({ id, name, parentId }));
    },
  )
  .delete(
    "/folders/:id",
    describeRoute({
      operationId: "trashFolder",
      tags: ["Documents"],
      description: "Move a folder and its contents to Trash",
      responses: {
        200: {
          description: "Folder moved to Trash",
          content: { "application/json": { schema: resolver(v.any()) } },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    workspaceAccess.fromFolder("id"),
    projectPermission.fromFolder({ doc: ["manage"] }),
    async (c) => {
      const { id } = c.req.valid("param");
      const currentUserId = c.get("userId");
      return c.json(await trashFolder(id, currentUserId));
    },
  )
  .post(
    "/folders/:id/restore",
    describeRoute({
      operationId: "restoreFolder",
      tags: ["Documents"],
      description: "Restore a folder from Trash",
      responses: {
        200: {
          description: "Folder restored",
          content: { "application/json": { schema: resolver(v.any()) } },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    workspaceAccess.fromFolder("id"),
    projectPermission.fromFolder({ doc: ["manage"] }),
    async (c) => {
      const { id } = c.req.valid("param");
      return c.json(await restoreFolder(id));
    },
  )
  .delete(
    "/folders/:id/purge",
    describeRoute({
      operationId: "purgeFolder",
      tags: ["Documents"],
      description: "Permanently delete a folder and its contents from Trash",
      responses: {
        200: {
          description: "Folder permanently deleted",
          content: { "application/json": { schema: resolver(v.any()) } },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    workspaceAccess.fromFolder("id"),
    projectPermission.fromFolder({ doc: ["empty_trash"] }),
    async (c) => {
      const { id } = c.req.valid("param");
      return c.json(await purgeFolder(id));
    },
  )
  // ── Trash ────────────────────────────────────────────────────────────────
  .get(
    "/trash/:projectId",
    describeRoute({
      operationId: "listTrash",
      tags: ["Documents"],
      description: "List the trashed folders and documents for a project",
      responses: {
        200: {
          description: "Trash contents (root-level trashed items)",
          content: { "application/json": { schema: resolver(v.any()) } },
        },
      },
    }),
    validator("param", v.object({ projectId: v.string() })),
    workspaceAccess.fromProject("projectId"),
    projectPermission.fromParam({ doc: ["manage"] }, "projectId"),
    async (c) => {
      const { projectId } = c.req.valid("param");
      return c.json(await listTrash(projectId));
    },
  )
  .delete(
    "/trash/:projectId",
    describeRoute({
      operationId: "emptyTrash",
      tags: ["Documents"],
      description: "Permanently delete everything in a project's Trash",
      responses: {
        200: {
          description: "Trash emptied",
          content: { "application/json": { schema: resolver(v.any()) } },
        },
      },
    }),
    validator("param", v.object({ projectId: v.string() })),
    workspaceAccess.fromProject("projectId"),
    projectPermission.fromParam({ doc: ["empty_trash"] }, "projectId"),
    async (c) => {
      const { projectId } = c.req.valid("param");
      return c.json(await emptyTrash(projectId));
    },
  )
  // ── Documents ────────────────────────────────────────────────────────────
  .get(
    "/list/:projectId",
    describeRoute({
      operationId: "listDocuments",
      tags: ["Documents"],
      description: "List documents in a project folder (or the root)",
      responses: {
        200: {
          description: "Documents in the folder",
          content: { "application/json": { schema: resolver(v.any()) } },
        },
      },
    }),
    validator("param", v.object({ projectId: v.string() })),
    validator("query", v.object({ folderId: v.optional(v.string()) })),
    workspaceAccess.fromProject("projectId"),
    projectPermission.fromParam({ doc: ["view"] }, "projectId"),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const { folderId } = c.req.valid("query");
      return c.json(await listDocuments(projectId, folderId || null));
    },
  )
  .post(
    "/:projectId",
    describeRoute({
      operationId: "uploadDocument",
      tags: ["Documents"],
      description: "Upload a document (multipart) to a project folder or root",
      responses: {
        200: {
          description: "Document uploaded",
          content: { "application/json": { schema: resolver(v.any()) } },
        },
      },
    }),
    validator("param", v.object({ projectId: v.string() })),
    workspaceAccess.fromProject("projectId"),
    projectPermission.fromParam({ doc: ["upload"] }, "projectId"),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const body = await c.req.parseBody();
      const file = body.file;
      if (!(file instanceof File)) {
        throw new HTTPException(400, { message: "No file provided" });
      }
      const folderId =
        typeof body.folderId === "string" && body.folderId
          ? body.folderId
          : null;
      const currentUserId = c.get("userId");
      return c.json(
        await uploadDocument({ projectId, folderId, file, currentUserId }),
      );
    },
  )
  .put(
    "/:id",
    describeRoute({
      operationId: "updateDocument",
      tags: ["Documents"],
      description: "Rename or move a document",
      responses: {
        200: {
          description: "Document updated",
          content: { "application/json": { schema: resolver(v.any()) } },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    validator(
      "json",
      v.object({
        name: v.optional(v.string()),
        folderId: v.optional(v.nullable(v.string())),
      }),
    ),
    workspaceAccess.fromDocument("id"),
    projectPermission.fromDocument({ doc: ["manage"] }),
    async (c) => {
      const { id } = c.req.valid("param");
      const { name, folderId } = c.req.valid("json");
      return c.json(await updateDocument({ id, name, folderId }));
    },
  )
  .delete(
    "/:id",
    describeRoute({
      operationId: "trashDocument",
      tags: ["Documents"],
      description: "Move a document to Trash",
      responses: {
        200: {
          description: "Document moved to Trash",
          content: { "application/json": { schema: resolver(v.any()) } },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    workspaceAccess.fromDocument("id"),
    projectPermission.fromDocument({ doc: ["manage"] }),
    async (c) => {
      const { id } = c.req.valid("param");
      const currentUserId = c.get("userId");
      return c.json(await trashDocument(id, currentUserId));
    },
  )
  .post(
    "/:id/restore",
    describeRoute({
      operationId: "restoreDocument",
      tags: ["Documents"],
      description: "Restore a document from Trash",
      responses: {
        200: {
          description: "Document restored",
          content: { "application/json": { schema: resolver(v.any()) } },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    workspaceAccess.fromDocument("id"),
    projectPermission.fromDocument({ doc: ["manage"] }),
    async (c) => {
      const { id } = c.req.valid("param");
      return c.json(await restoreDocument(id));
    },
  )
  .delete(
    "/:id/purge",
    describeRoute({
      operationId: "purgeDocument",
      tags: ["Documents"],
      description: "Permanently delete a document from Trash",
      responses: {
        200: {
          description: "Document permanently deleted",
          content: { "application/json": { schema: resolver(v.any()) } },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    workspaceAccess.fromDocument("id"),
    projectPermission.fromDocument({ doc: ["empty_trash"] }),
    async (c) => {
      const { id } = c.req.valid("param");
      return c.json(await purgeDocument(id));
    },
  )
  .get(
    "/:id/download",
    describeRoute({
      operationId: "downloadDocument",
      tags: ["Documents"],
      description: "Download a document's file",
      responses: {
        200: {
          description: "The document binary stream",
          content: { "*/*": { schema: resolver(v.any()) } },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    workspaceAccess.fromDocument("id"),
    projectPermission.fromDocument({ doc: ["view"] }),
    async (c) => {
      const { id } = c.req.valid("param");
      const doc = await getDocument(id);
      try {
        const object = await storage.get(doc.storageKey);
        return new Response(object.body as BodyInit, {
          headers: {
            "Content-Disposition": contentDisposition(doc.name),
            "Content-Type": doc.contentType,
            "Content-Length":
              object.contentLength?.toString() ?? String(doc.size),
            "Cache-Control": "private, max-age=120",
          },
        });
      } catch (error) {
        console.error("Failed to stream document:", error);
        throw new HTTPException(404, { message: "Document file not found" });
      }
    },
  );

export default document;
