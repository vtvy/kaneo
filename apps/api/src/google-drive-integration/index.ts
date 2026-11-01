import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import type { Context } from "hono";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import { describeRoute, validator } from "hono-openapi";
import * as v from "valibot";
import { auth } from "../auth";
import db from "../database";
import {
  integrationTable,
  projectTable,
  userTable,
  verificationTable,
} from "../database/schema";
import * as drive from "../document/drive/client";
import {
  GOOGLE_DRIVE_INTEGRATION_TYPE,
  type GoogleDriveConfig,
  getClientCreds,
  getDriveIntegration,
  getDriveIntegrationRow,
  getRefreshToken,
  isConfigured,
} from "../document/drive/config";
import { getInstanceSettings } from "../instance-settings/get-instance-settings";
import { canInProjectAll } from "../project-rbac/can-in-project";
import { projectPermission } from "../project-rbac/require-project-permission";
import {
  memberHasWorkspacePermission,
  requireWorkspacePermission,
} from "../utils/require-workspace-permission";
import { encryptSecret } from "../utils/secret-box";
import { validateWorkspaceAccess } from "../utils/validate-workspace-access";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { assertWorkspaceWritable } from "../workspace/archive/workspace-archived";

const SCOPES =
  "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/userinfo.email";
const COOKIE = "kaneo_drive_oauth";
const STATE_TTL_MS = 10 * 60 * 1000;
const projectParam = v.object({
  projectId: v.pipe(v.string(), v.minLength(1)),
});
const driveId = v.pipe(v.string(), v.regex(/^[a-zA-Z0-9_-]{1,256}$/));
export function getDriveRedirectUri() {
  const url = new URL(process.env.KANEO_API_URL || "http://localhost:1337");
  const base = url.pathname.replace(/\/+$/, "");
  url.pathname =
    (base.endsWith("/api") ? base : `${base}/api`) +
    "/google-drive-integration/callback";
  url.search = "";
  url.hash = "";
  return url.toString();
}
function clientRedirect(projectId: string, status: string) {
  const url = new URL(process.env.KANEO_CLIENT_URL || "http://localhost:5173");
  url.pathname = projectId
    ? "/dashboard/settings/projects/" +
      encodeURIComponent(projectId) +
      "/integrations"
    : "/dashboard";
  url.search = new URLSearchParams({ drive: status }).toString();
  url.hash = "";
  return url.toString();
}
async function assertEnabled() {
  if (
    (await getInstanceSettings()).disabledIntegrations.includes(
      GOOGLE_DRIVE_INTEGRATION_TYPE,
    )
  )
    throw new HTTPException(403, {
      message: "An administrator turned this integration off.",
    });
}
async function connected(projectId: string) {
  const integration = await getDriveIntegration(projectId);
  if (!integration)
    throw new HTTPException(400, { message: "Google Drive is not connected" });
  return integration;
}
async function tokenFor(projectId: string) {
  const integration = await connected(projectId);
  return drive.getAccessToken(
    getClientCreds(integration.config),
    getRefreshToken(integration.config),
  );
}
async function upsertConfig(
  projectId: string,
  config: GoogleDriveConfig,
  expectedRawConfig?: string,
  authorize?: () => Promise<void>,
) {
  // Serialize the check/insert even before the optional unique index exists.
  await db.transaction(async (tx) => {
    const { sql } = await import("drizzle-orm");
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`drive:${projectId}`}))`,
    );
    const [existing] = await tx
      .select()
      .from(integrationTable)
      .where(
        and(
          eq(integrationTable.projectId, projectId),
          eq(integrationTable.type, GOOGLE_DRIVE_INTEGRATION_TYPE),
        ),
      )
      .limit(1)
      .for("update");
    if (
      expectedRawConfig !== undefined &&
      existing?.config !== expectedRawConfig
    )
      throw new HTTPException(409, {
        message: "Drive settings changed; try again",
      });
    if (authorize) await authorize();
    if (existing)
      await tx
        .update(integrationTable)
        .set({
          config: JSON.stringify(config),
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(integrationTable.id, existing.id));
    else
      await tx.insert(integrationTable).values({
        projectId,
        type: GOOGLE_DRIVE_INTEGRATION_TYPE,
        config: JSON.stringify(config),
        isActive: true,
      });
  });
}
const manage = projectPermission.fromParam({ doc: ["manage"] });
const workspaceManage = requireWorkspacePermission({
  workspace: ["manage_settings"],
});
const googleDriveIntegration = new Hono<{
  Variables: { userId: string; workspaceId: string; apiKey?: { id: string } };
}>()
  .get(
    "/project/:projectId",
    describeRoute({
      operationId: "getGoogleDriveIntegration",
      tags: ["Google Drive"],
      description: "Project Drive connection status without secrets",
    }),
    validator("param", projectParam),
    workspaceAccess.fromProject("projectId"),
    projectPermission.fromParam({ doc: ["view"] }),
    async (c) => {
      const integration = await getDriveIntegrationRow(
        c.req.valid("param").projectId,
      );
      const cfg = integration?.config;
      return c.json({
        configured: Boolean(cfg && isConfigured(cfg)),
        connected: Boolean(integration?.isActive && cfg?.refreshToken),
        disabled: (await getInstanceSettings()).disabledIntegrations.includes(
          GOOGLE_DRIVE_INTEGRATION_TYPE,
        ),
        clientId: cfg?.clientId ?? null,
        redirectUri: getDriveRedirectUri(),
        accountEmail: cfg?.accountEmail ?? null,
        rootFolderId: cfg?.rootFolderId ?? null,
        rootFolderName: cfg?.rootFolderName ?? null,
      });
    },
  )
  .put(
    "/project/:projectId/credentials",
    describeRoute({
      operationId: "setGoogleDriveCredentials",
      tags: ["Google Drive"],
      description: "Save encrypted per-project OAuth credentials",
    }),
    validator("param", projectParam),
    validator(
      "json",
      v.object({
        clientId: v.pipe(
          v.string(),
          v.trim(),
          v.minLength(1),
          v.maxLength(500),
        ),
        clientSecret: v.pipe(
          v.string(),
          v.trim(),
          v.minLength(1),
          v.maxLength(1000),
        ),
      }),
    ),
    workspaceAccess.fromProject("projectId"),
    manage,
    workspaceManage,
    async (c) => {
      await assertEnabled();
      const { projectId } = c.req.valid("param");
      const { clientId, clientSecret } = c.req.valid("json");
      // Replacing credentials always requires reconnecting; no stale token survives.
      await upsertConfig(projectId, {
        clientId,
        clientSecret: encryptSecret(clientSecret),
        connectedBy: c.get("userId"),
      });
      return c.json({ success: true });
    },
  )
  .post(
    "/project/:projectId/connect",
    describeRoute({
      operationId: "connectGoogleDrive",
      tags: ["Google Drive"],
      description: "Begin a browser-bound, single-use Google OAuth flow",
    }),
    validator("param", projectParam),
    workspaceAccess.fromProject("projectId"),
    manage,
    workspaceManage,
    async (c) => {
      await assertEnabled();
      if (c.get("apiKey"))
        throw new HTTPException(403, {
          message: "Use a browser session to connect Drive",
        });
      const { projectId } = c.req.valid("param");
      const integration = await getDriveIntegrationRow(projectId);
      if (!integration || !isConfigured(integration.config))
        throw new HTTPException(400, {
          message: "Configure Google OAuth credentials first",
        });
      const state = randomBytes(32).toString("base64url");
      const nonce = randomBytes(32).toString("base64url");
      await db.insert(verificationTable).values({
        identifier: `drive-oauth:${state}`,
        value: JSON.stringify({
          projectId,
          userId: c.get("userId"),
          nonceHash: createHash("sha256").update(nonce).digest("hex"),
          clientSecret: integration.config.clientSecret,
          clientId: integration.config.clientId,
        }),
        expiresAt: new Date(Date.now() + STATE_TTL_MS),
      });
      setCookie(c, COOKIE, nonce, {
        httpOnly: true,
        secure: getDriveRedirectUri().startsWith("https:"),
        sameSite: "Lax",
        path: "/",
        maxAge: STATE_TTL_MS / 1000,
      });
      const params = new URLSearchParams({
        client_id: integration.config.clientId as string,
        redirect_uri: getDriveRedirectUri(),
        response_type: "code",
        scope: SCOPES,
        access_type: "offline",
        prompt: "consent",
        include_granted_scopes: "true",
        state,
      });
      return c.json({
        url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      });
    },
  )
  .get(
    "/project/:projectId/folders",
    describeRoute({
      operationId: "listGoogleDriveFolders",
      tags: ["Google Drive"],
      description: "Browse available folders to choose the project root",
    }),
    validator("param", projectParam),
    validator("query", v.object({ parentId: v.optional(driveId) })),
    workspaceAccess.fromProject("projectId"),
    manage,
    workspaceManage,
    async (c) => {
      await assertEnabled();
      return c.json(
        await drive.listFiles(
          await tokenFor(c.req.valid("param").projectId),
          c.req.valid("query").parentId || "root",
          true,
        ),
      );
    },
  )
  .put(
    "/project/:projectId",
    describeRoute({
      operationId: "setGoogleDriveFolder",
      tags: ["Google Drive"],
      description: "Choose a verified Drive folder for documents",
    }),
    validator("param", projectParam),
    validator(
      "json",
      v.object({
        rootFolderId: driveId,
        rootFolderName: v.optional(v.string()),
      }),
    ),
    workspaceAccess.fromProject("projectId"),
    manage,
    workspaceManage,
    async (c) => {
      await assertEnabled();
      const { projectId } = c.req.valid("param");
      const integration = await connected(projectId);
      const { rootFolderId } = c.req.valid("json");
      const folder = await drive.getFileMeta(
        await tokenFor(projectId),
        rootFolderId,
      );
      if (folder.mimeType !== drive.DRIVE_FOLDER_MIME)
        throw new HTTPException(400, {
          message: "Select a Google Drive folder",
        });
      await upsertConfig(
        projectId,
        {
          ...integration.config,
          rootFolderId: folder.id,
          rootFolderName: folder.name,
        },
        integration.rawConfig,
      );
      return c.json({ success: true });
    },
  )
  .delete(
    "/project/:projectId",
    describeRoute({
      operationId: "disconnectGoogleDrive",
      tags: ["Google Drive"],
      description:
        "Remove a project connection without deleting Drive originals",
    }),
    validator("param", projectParam),
    workspaceAccess.fromProject("projectId"),
    manage,
    workspaceManage,
    async (c) => {
      const { projectId } = c.req.valid("param");
      const integration = await getDriveIntegrationRow(projectId);
      await db
        .delete(integrationTable)
        .where(
          and(
            eq(integrationTable.projectId, projectId),
            eq(integrationTable.type, GOOGLE_DRIVE_INTEGRATION_TYPE),
          ),
        );
      if (integration?.config.refreshToken)
        await drive.revokeToken(getRefreshToken(integration.config));
      return c.json({ success: true });
    },
  );

async function assertCallbackAccess(
  c: Context,
  userId: string,
  projectId: string,
) {
  const currentSession = await auth.api.getSession({
    headers: c.req.raw.headers,
    query: { disableCookieCache: true },
  });
  if (!currentSession || currentSession.user.id !== userId)
    throw new Error("Session revoked");
  const [project] = await db
    .select({ workspaceId: projectTable.workspaceId })
    .from(projectTable)
    .where(eq(projectTable.id, projectId))
    .limit(1);
  const [user] = await db
    .select({
      role: userTable.role,
      banned: userTable.banned,
      banExpires: userTable.banExpires,
    })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);
  if (
    !project ||
    !user ||
    (user.banned && (!user.banExpires || user.banExpires > new Date()))
  )
    throw new Error("Access revoked");
  await validateWorkspaceAccess(userId, project.workspaceId);
  await assertWorkspaceWritable(project.workspaceId);
  await assertEnabled();
  if (
    user.role !== "admin" &&
    (!(await canInProjectAll(userId, projectId, {
      doc: ["manage"],
    })) ||
      !(await memberHasWorkspacePermission(userId, project.workspaceId, {
        workspace: ["manage_settings"],
      })))
  )
    throw new Error("Permission revoked");
}

// Public redirect endpoint: independently revalidate session, browser nonce and
// project/workspace permissions. State is atomically consumed in PostgreSQL.
export async function handleGoogleDriveCallback(c: Context) {
  let projectId = "";
  try {
    const state = c.req.query("state");
    const code = c.req.query("code");
    const nonce = getCookie(c, COOKIE);
    deleteCookie(c, COOKIE, { path: "/" });
    if (
      c.req.query("error") ||
      !state ||
      !code ||
      !nonce ||
      !/^[a-zA-Z0-9_-]{43}$/.test(state)
    )
      throw new Error("Invalid callback");
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
      query: { disableCookieCache: true },
    });
    if (!session) throw new Error("Session required");
    const [pending] = await db
      .delete(verificationTable)
      .where(
        and(
          eq(verificationTable.identifier, `drive-oauth:${state}`),
          gt(verificationTable.expiresAt, new Date()),
        ),
      )
      .returning();
    if (!pending) throw new Error("Expired state");
    const saved = JSON.parse(pending.value) as {
      projectId: string;
      userId: string;
      nonceHash: string;
      clientId: string;
      clientSecret: string;
    };
    if (
      saved.userId !== session.user.id ||
      saved.nonceHash !== createHash("sha256").update(nonce).digest("hex")
    )
      throw new Error("State binding mismatch");
    projectId = saved.projectId;
    await assertCallbackAccess(c, session.user.id, projectId);
    const existing = await getDriveIntegrationRow(projectId);
    if (
      !existing ||
      existing.config.clientId !== saved.clientId ||
      existing.config.clientSecret !== saved.clientSecret
    )
      throw new Error("Credentials changed");
    const tokens = await drive.exchangeCodeForTokens(
      getClientCreds(existing.config),
      code,
      getDriveRedirectUri(),
    );
    if (!tokens.refresh_token)
      return c.redirect(clientRedirect(projectId, "norefresh"));
    const accountEmail = await drive.getUserEmail(tokens.access_token);
    await upsertConfig(
      projectId,
      {
        ...existing.config,
        refreshToken: encryptSecret(tokens.refresh_token),
        accountEmail: accountEmail ?? undefined,
        scope: tokens.scope,
        connectedBy: session.user.id,
      },
      existing.rawConfig,
      () => assertCallbackAccess(c, session.user.id, projectId),
    );
    return c.redirect(clientRedirect(projectId, "connected"));
  } catch {
    return c.redirect(clientRedirect(projectId, "error"));
  }
}
export default googleDriveIntegration;
