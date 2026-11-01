export type BearerCredential = {
  kind: "bearer";
  token: string;
  source: "session" | "apiKey";
};

export type CookieCredential = {
  kind: "cookie";
  cookie: string;
};

export type SessionCredential = BearerCredential | CookieCredential;

export function cookieHeaderFromSetCookie(
  setCookie: string | null,
): string | null {
  if (!setCookie?.trim()) return null;

  const parts = setCookie.split(/,(?=\s*[^;,]+=)/);
  const pairs: string[] = [];
  for (const part of parts) {
    const pair = part.split(";")[0]?.trim();
    if (pair?.includes("=")) pairs.push(pair);
  }
  return pairs.length > 0 ? pairs.join("; ") : null;
}

export function credentialFromSignIn(input: {
  setAuthToken: string | null;
  bodyToken: unknown;
  setCookie: string | null;
}): SessionCredential | null {
  const headerToken = input.setAuthToken?.trim();
  if (headerToken) {
    return { kind: "bearer", token: headerToken, source: "session" };
  }
  if (typeof input.bodyToken === "string" && input.bodyToken.trim()) {
    return {
      kind: "bearer",
      token: input.bodyToken.trim(),
      source: "session",
    };
  }
  const cookie = cookieHeaderFromSetCookie(input.setCookie);
  if (cookie) return { kind: "cookie", cookie };
  return null;
}

export function authHeaders(
  credential: SessionCredential,
): Record<string, string> {
  if (credential.kind === "cookie") {
    return { Cookie: credential.cookie };
  }
  return { Authorization: `Bearer ${credential.token}` };
}
