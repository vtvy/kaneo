import type { WSContext } from "hono/ws";

/** The credential a socket was opened with, kept so revocation can target it. */
export type SocketCredential = {
  userId: string;
  /** Better Auth session id (cookie or bearer session). */
  sessionId?: string;
  /** Kaneo API key id (Bearer API key). */
  apiKeyId?: string;
};

export type RevocableConnection = SocketCredential & {
  ws: WSContext;
  workspaceId?: string;
};

/**
 * Sent through the broadcast adapter so every API instance closes (or
 * re-checks) its own matching sockets.
 * - `sessions` / `apiKeys`: close sockets opened with these credentials.
 * - `user`: close every socket of the user (ban, delete).
 * - `access`: re-check the user's sockets, optionally only for one project or
 *   workspace, and close the ones that lost read access.
 */
export type SocketRevocation =
  | { kind: "sessions"; sessionIds: string[] }
  | { kind: "apiKeys"; apiKeyIds: string[] }
  | { kind: "user"; userId: string }
  | {
      kind: "access";
      userId: string;
      projectId?: string;
      workspaceId?: string;
    };

export const REVOKED_CLOSE_CODE = 1008;

/** Whether a revocation that closes outright (not `access`) hits this socket. */
export function revocationMatches(
  conn: RevocableConnection,
  revocation: SocketRevocation,
): boolean {
  switch (revocation.kind) {
    case "sessions":
      return !!conn.sessionId && revocation.sessionIds.includes(conn.sessionId);
    case "apiKeys":
      // Better Auth's x-api-key sessions use the key id as the session id.
      return revocation.apiKeyIds.some(
        (id) => id === conn.apiKeyId || id === conn.sessionId,
      );
    case "user":
      return conn.userId === revocation.userId;
    case "access":
      return false;
  }
}

/** Whether an `access` revocation asks to re-check this socket. */
export function accessRecheckApplies(
  conn: RevocableConnection,
  projectId: string,
  revocation: Extract<SocketRevocation, { kind: "access" }>,
): boolean {
  if (conn.userId !== revocation.userId) return false;
  if (revocation.projectId && revocation.projectId !== projectId) return false;
  if (revocation.workspaceId && revocation.workspaceId !== conn.workspaceId) {
    return false;
  }
  return true;
}

export function closeSocket(ws: WSContext, reason: string) {
  try {
    ws.close(REVOKED_CLOSE_CODE, reason);
  } catch {
    // Already closed.
  }
}

const REASONS: Record<SocketRevocation["kind"], string> = {
  sessions: "Session revoked",
  apiKeys: "API key revoked",
  user: "Access revoked",
  access: "Access revoked",
};

/**
 * Closes and unregisters the local sockets a revocation targets. For
 * `access`, `stillAllowed` decides per socket. Returns the number closed.
 */
export async function applyRevocation<C extends RevocableConnection>(
  connections: Map<string, Set<C>>,
  revocation: SocketRevocation,
  stillAllowed?: (conn: C, projectId: string) => Promise<boolean>,
): Promise<number> {
  const targets: [string, C][] = [];
  for (const [projectId, conns] of connections) {
    for (const conn of conns) {
      if (revocation.kind === "access") {
        if (!accessRecheckApplies(conn, projectId, revocation)) continue;
        if (stillAllowed && (await stillAllowed(conn, projectId))) continue;
      } else if (!revocationMatches(conn, revocation)) {
        continue;
      }
      targets.push([projectId, conn]);
    }
  }

  for (const [projectId, conn] of targets) {
    const conns = connections.get(projectId);
    conns?.delete(conn);
    if (conns?.size === 0) connections.delete(projectId);
    closeSocket(conn.ws, REASONS[revocation.kind]);
  }
  return targets.length;
}
