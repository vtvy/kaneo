import type { Readable } from "node:stream";
import { publicFetch } from "../../utils/public-fetch";

// Google endpoints are fixed; IDs must never introduce path/query syntax.
export function assertDriveId(id: string): string {
  if (!/^[a-zA-Z0-9_-]{1,256}$/.test(id))
    throw new Error("Invalid Google Drive file ID");
  return id;
}

async function googleFetch(url: string, init: RequestInit = {}) {
  const response = await publicFetch(url, {
    ...init,
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Google Drive request failed (${response.status})`);
  }
  return response;
}

// Minimal Google Drive REST v3 client built on raw fetch (no googleapis dep),
// consistent with the gitea/github integrations.
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3";

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  webViewLink?: string;
  modifiedTime?: string;
  parents?: string[];
};

// OAuth app credentials, supplied by the caller (resolved from the project's
// per-project integration config — see drive/config.ts). No env reads here.
export type ClientCreds = { clientId: string; clientSecret: string };

export const DRIVE_FOLDER_MIME = "application/vnd.google-apps.folder";

// Short-lived access-token cache keyed by refresh token (~1h tokens).
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

export async function getAccessToken(
  creds: ClientCreds,
  refreshToken: string,
): Promise<string> {
  const cacheKey = `${creds.clientId}:${refreshToken}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const { clientId, clientSecret } = creds;
  const res = await googleFetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(`Google Drive request failed (${res.status})`);
  }
  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  if (tokenCache.size > 200) tokenCache.clear();
  tokenCache.set(cacheKey, {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  });
  return data.access_token;
}

export async function exchangeCodeForTokens(
  creds: ClientCreds,
  code: string,
  redirectUri: string,
) {
  const { clientId, clientSecret } = creds;
  const res = await googleFetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    throw new Error(`Google Drive request failed (${res.status})`);
  }
  return (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
  };
}

export async function getUserEmail(
  accessToken: string,
): Promise<string | null> {
  const res = await googleFetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { email?: string };
  return data.email ?? null;
}

export async function listFiles(
  token: string,
  parentId: string,
  foldersOnly = false,
): Promise<DriveFile[]> {
  assertDriveId(parentId);
  const clauses = [`'${parentId}' in parents`, "trashed = false"];
  if (foldersOnly) clauses.push(`mimeType = '${DRIVE_FOLDER_MIME}'`);
  const q = encodeURIComponent(clauses.join(" and "));
  const fields = encodeURIComponent(
    "nextPageToken,files(id,name,mimeType,size,webViewLink,modifiedTime)",
  );
  const files: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const suffix = pageToken
      ? `&pageToken=${encodeURIComponent(pageToken)}`
      : "";
    const res = await googleFetch(
      `${DRIVE_API}/files?q=${q}&fields=${fields}&pageSize=1000&orderBy=folder,name&supportsAllDrives=true&includeItemsFromAllDrives=true${suffix}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const data = (await res.json()) as {
      files?: DriveFile[];
      nextPageToken?: string;
    };
    files.push(...(data.files ?? []));
    pageToken = data.nextPageToken;
    if (files.length > 100_000)
      throw new Error("Drive folder contains too many files");
  } while (pageToken);
  return files;
}

export async function getFileMeta(
  token: string,
  id: string,
): Promise<DriveFile> {
  const fields = encodeURIComponent(
    "id,name,mimeType,size,webViewLink,modifiedTime,parents",
  );
  const res = await googleFetch(
    `${DRIVE_API}/files/${assertDriveId(id)}?fields=${fields}&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Google Drive request failed (${res.status})`);
  return (await res.json()) as DriveFile;
}

export async function uploadFile(
  token: string,
  parentId: string,
  data: Buffer,
  name: string,
  mimeType: string,
): Promise<DriveFile> {
  assertDriveId(parentId);
  const safeMimeType = /^[a-zA-Z0-9!#&^_.+-]+\/[a-zA-Z0-9!#&^_.+-]+$/.test(
    mimeType,
  )
    ? mimeType
    : "application/octet-stream";
  const metadata = { name, parents: [parentId] };
  const boundary = `kaneo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
    ),
    Buffer.from(JSON.stringify(metadata)),
    Buffer.from(`\r\n--${boundary}\r\nContent-Type: ${safeMimeType}\r\n\r\n`),
    data,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const fields = encodeURIComponent("id,name,mimeType,size,webViewLink");
  const res = await googleFetch(
    `${DRIVE_UPLOAD}/files?uploadType=multipart&fields=${fields}&supportsAllDrives=true`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  if (!res.ok) throw new Error(`Google Drive request failed (${res.status})`);
  return (await res.json()) as DriveFile;
}

export async function streamFile(
  token: string,
  id: string,
): Promise<{ body: ReadableStream | Readable; contentLength?: number }> {
  const meta = await getFileMeta(token, id);
  const url = meta.mimeType.startsWith("application/vnd.google-apps.")
    ? `${DRIVE_API}/files/${assertDriveId(id)}/export?mimeType=application%2Fpdf`
    : `${DRIVE_API}/files/${assertDriveId(id)}?alt=media&supportsAllDrives=true`;
  const res = await googleFetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok || !res.body) {
    throw new Error(`Google Drive request failed (${res.status})`);
  }
  const len = res.headers.get("content-length");
  return {
    body: res.body as ReadableStream,
    contentLength: len ? Number(len) : undefined,
  };
}

export async function deleteFile(token: string, id: string): Promise<void> {
  const res = await googleFetch(
    `${DRIVE_API}/files/${assertDriveId(id)}?supportsAllDrives=true`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!res.ok && res.status !== 404) {
    throw new Error(`Google Drive request failed (${res.status})`);
  }
}

export async function revokeToken(token: string): Promise<void> {
  await googleFetch(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, {
    method: "POST",
  }).catch(() => {});
}
