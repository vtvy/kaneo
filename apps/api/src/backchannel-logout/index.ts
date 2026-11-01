import type { Context, MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";
import { closeSocketsForSession } from "../ws";
import { resolveBackchannelLogoutConfig } from "./config";
import { endProviderSessions } from "./controllers/end-provider-sessions";
import { LogoutProviderUnavailable, LogoutTokenRejected } from "./errors";
import { providerJwks } from "./provider-jwks";
import { getProviderMetadata } from "./provider-metadata";
import { verifyLogoutToken } from "./verify-logout-token";

const MAX_LOGOUT_REQUEST_BYTES = 16 * 1024;

const COMPACT_JWS = /^[\w-]+\.[\w-]+\.[\w-]+$/;

export const noStore: MiddlewareHandler = async (c, next) => {
  await next();
  c.res.headers.set("Cache-Control", "no-store");
};

export const logoutBodyLimit = bodyLimit({
  maxSize: MAX_LOGOUT_REQUEST_BYTES,
  onError: (c) => c.json({ error: "invalid_request" }, 413),
});

async function readLogoutToken(c: Context) {
  const type = c.req
    .header("content-type")
    ?.split(";")[0]
    ?.trim()
    .toLowerCase();
  if (type !== "application/x-www-form-urlencoded") return null;
  const tokens = new URLSearchParams(await c.req.text()).getAll("logout_token");
  const [token] = tokens;
  return tokens.length === 1 && token && COMPACT_JWS.test(token) ? token : null;
}

async function loadLogoutTokenProvider(discoveryUrl: string) {
  const { issuer, algorithms, jwksUri } =
    await getProviderMetadata(discoveryUrl);
  return { issuer, algorithms, ...providerJwks(jwksUri) };
}

// OpenID Connect Back-Channel Logout 1.0, called by the identity provider.
export async function handleBackchannelLogoutRoute(c: Context) {
  const config = resolveBackchannelLogoutConfig();
  if (!config.enabled) return c.json({ error: "not_found" }, 404);

  const token = await readLogoutToken(c);
  if (!token) return c.json({ error: "invalid_request" }, 400);

  let endedSessionIds: string[];
  try {
    const claims = await verifyLogoutToken(token, config.clientId, () =>
      loadLogoutTokenProvider(config.discoveryUrl),
    );
    endedSessionIds = (await endProviderSessions(claims)).map(({ id }) => id);
  } catch (error) {
    if (error instanceof LogoutProviderUnavailable) {
      console.warn(`Back-channel logout is unavailable: ${error.message}`);
      return c.json({ error: "temporarily_unavailable" }, 503);
    }
    if (error instanceof LogoutTokenRejected) {
      console.warn(`Rejected a back-channel logout token: ${error.message}`);
      return c.json({ error: "invalid_request" }, 400);
    }
    throw error;
  }

  // The rows are already gone; a failure here only leaves sockets open.
  await closeSocketsForSession(endedSessionIds).catch((error) => {
    console.error(
      "Closing realtime connections after a back-channel logout failed:",
      error,
    );
  });

  return c.body(null, 200);
}
