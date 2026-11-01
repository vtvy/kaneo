const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Allowed browser origins, from CORS_ORIGINS (comma separated) or, failing
 * that, KANEO_CLIENT_URL. `undefined` means nothing is configured.
 */
export function resolveCorsOrigins(
  env: Record<string, string | undefined> = process.env,
): string[] | undefined {
  const source = [env.CORS_ORIGINS, env.KANEO_CLIENT_URL].find((value) =>
    value?.trim(),
  );

  return source
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/**
 * Whether a browser origin may make credentialed requests. With configured
 * origins this is an exact match. Without configuration only local dev
 * origins (http(s)://localhost|127.0.0.1|[::1] on any port) and the API's own
 * host are allowed — never an arbitrary site, since responses carry
 * credentials.
 */
export function isAllowedOrigin(
  origin: string,
  corsOrigins: string[] | undefined,
  requestHost?: string,
): boolean {
  if (corsOrigins) {
    return corsOrigins.includes(origin);
  }

  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return false;
  }

  if (LOOPBACK_HOSTNAMES.has(url.hostname)) {
    return true;
  }

  return Boolean(requestHost) && url.host === requestHost?.toLowerCase();
}
