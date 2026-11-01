import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { ApiError, messageFromBody } from "@/lib/api-error";
import { buildApiUrl, normalizeServerOrigin } from "@/lib/api-url";
import {
  authHeaders,
  credentialFromSignIn,
  type SessionCredential,
} from "@/lib/auth-credential";
import {
  filenameFromContentDisposition,
  safeDownloadName,
} from "@/lib/content-disposition";
import { type ProjectAccess, parseProjectAccess } from "@/lib/permissions";
import { type Session, saveSession } from "@/lib/session-store";
import type {
  BoardResponse,
  Comment,
  CurrentUser,
  DocumentItem,
  FolderItem,
  Member,
  NotificationItem,
  Project,
  Sprint,
  SprintTask,
  TaskDetail,
  Workspace,
} from "@/lib/types";

export type { Session };

let activeSession: Session | null = null;

export function setApiSession(session: Session | null) {
  activeSession = session;
}

type Query = Record<string, string | number | boolean | null | undefined>;

type RequestOptions = {
  method?: string;
  query?: Query;
  body?: unknown;
  form?: FormData;
  session?: Pick<Session, "serverUrl" | "credential">;
  accept?: string;
};

function requireSession(): Session {
  if (!activeSession) {
    throw new ApiError("Chưa đăng nhập.", 401);
  }
  return activeSession;
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function readSetCookie(headers: Headers): string | null {
  const withSetCookie = headers as Headers & {
    getSetCookie?: () => string[];
  };
  if (typeof withSetCookie.getSetCookie === "function") {
    const values = withSetCookie.getSetCookie();
    if (values.length > 0) return values.join(", ");
  }
  return headers.get("set-cookie");
}

async function request(
  path: string,
  options: RequestOptions = {},
): Promise<unknown> {
  const session = options.session ?? requireSession();
  const headers: Record<string, string> = {
    Accept: options.accept ?? "application/json",
    ...authHeaders(session.credential),
  };
  let body: BodyInit | undefined;
  if (options.form) {
    body = options.form;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  const response = await fetch(
    buildApiUrl(session.serverUrl, path, options.query),
    {
      method: options.method ?? "GET",
      headers,
      body,
    },
  );
  const payload = await readBody(response);
  if (!response.ok) {
    throw new ApiError(
      messageFromBody(payload, response.status),
      response.status,
    );
  }
  return payload;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

export async function probeServer(originInput: string): Promise<string> {
  const serverUrl = normalizeServerOrigin(originInput);
  const response = await fetch(buildApiUrl(serverUrl, "/api/config"), {
    headers: { Accept: "application/json" },
  });
  const payload = await readBody(response);
  if (!response.ok) {
    throw new ApiError(
      messageFromBody(payload, response.status),
      response.status,
    );
  }
  const record = asRecord(payload);
  if (!record || typeof record.instanceName !== "string") {
    throw new ApiError("Địa chỉ này không phải máy chủ Kaneo.");
  }
  return serverUrl;
}

async function currentUser(
  serverUrl: string,
  credential: SessionCredential,
): Promise<CurrentUser> {
  const payload = await request("/api/user/me", {
    session: { serverUrl, credential },
  });
  const record = asRecord(payload);
  if (
    !record ||
    typeof record.id !== "string" ||
    typeof record.email !== "string"
  ) {
    throw new ApiError("Không đọc được hồ sơ người dùng.");
  }
  return {
    id: record.id,
    email: record.email,
    name: typeof record.name === "string" ? record.name : record.email,
  };
}

async function persist(
  serverUrl: string,
  credential: SessionCredential,
): Promise<Session> {
  const user = await currentUser(serverUrl, credential);
  const session = { serverUrl, credential, user };
  await saveSession(session);
  setApiSession(session);
  return session;
}

export async function signInWithPassword(
  originInput: string,
  email: string,
  password: string,
): Promise<Session> {
  const serverUrl = await probeServer(originInput);
  const response = await fetch(
    buildApiUrl(serverUrl, "/api/auth/sign-in/email"),
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: email.trim(),
        password,
        rememberMe: true,
      }),
    },
  );
  const payload = await readBody(response);
  if (!response.ok) {
    throw new ApiError(
      messageFromBody(payload, response.status),
      response.status,
    );
  }
  const record = asRecord(payload);
  const credential = credentialFromSignIn({
    setAuthToken: response.headers.get("set-auth-token"),
    bodyToken: record?.token,
    setCookie: readSetCookie(response.headers),
  });
  if (!credential) {
    throw new ApiError("Máy chủ không trả phiên đăng nhập.");
  }
  return persist(serverUrl, credential);
}

export async function signInWithApiKey(
  originInput: string,
  apiKey: string,
): Promise<Session> {
  const serverUrl = await probeServer(originInput);
  const token = apiKey.trim();
  if (!token) throw new ApiError("Nhập khóa API.");
  return persist(serverUrl, { kind: "bearer", token, source: "apiKey" });
}

export async function signOutFromServer(): Promise<void> {
  const session = activeSession;
  if (!session) return;
  if (
    session.credential.kind === "bearer" &&
    session.credential.source === "apiKey"
  ) {
    return;
  }
  try {
    await request("/api/auth/sign-out", { method: "POST", session });
  } catch {
    // Đăng xuất trên máy vẫn tiếp tục khi máy chủ không phản hồi.
  }
}

export function listWorkspaces(): Promise<Workspace[]> {
  return request("/api/workspace") as Promise<Workspace[]>;
}

export function listProjects(workspaceId: string): Promise<Project[]> {
  return request("/api/project", {
    query: { workspaceId },
  }) as Promise<Project[]>;
}

export function getProject(projectId: string): Promise<Project> {
  return request(`/api/project/${projectId}`) as Promise<Project>;
}

export async function getProjectAccess(
  projectId: string,
): Promise<ProjectAccess> {
  const payload = await request(`/api/project-rbac/${projectId}/me`);
  return parseProjectAccess(payload);
}

export function getBoard(projectId: string): Promise<BoardResponse> {
  return request(`/api/task/tasks/${projectId}`) as Promise<BoardResponse>;
}

export function getTask(taskId: string): Promise<TaskDetail> {
  return request(`/api/task/${taskId}`) as Promise<TaskDetail>;
}

export function createTask(
  projectId: string,
  body: {
    title: string;
    description: string;
    priority: string;
    status?: string;
  },
): Promise<unknown> {
  return request(`/api/task/${projectId}`, { method: "POST", body });
}

export function updateTaskTitle(
  taskId: string,
  title: string,
): Promise<unknown> {
  return request(`/api/task/title/${taskId}`, {
    method: "PUT",
    body: { title },
  });
}

export function updateTaskDescription(
  taskId: string,
  description: string,
): Promise<unknown> {
  return request(`/api/task/description/${taskId}`, {
    method: "PUT",
    body: { description },
  });
}

export function updateTaskStatus(
  taskId: string,
  status: string,
): Promise<unknown> {
  return request(`/api/task/status/${taskId}`, {
    method: "PUT",
    body: { status },
  });
}

export function updateTaskPriority(
  taskId: string,
  priority: string,
): Promise<unknown> {
  return request(`/api/task/priority/${taskId}`, {
    method: "PUT",
    body: { priority },
  });
}

export function updateTaskAssignee(
  taskId: string,
  userId: string,
): Promise<unknown> {
  return request(`/api/task/assignee/${taskId}`, {
    method: "PUT",
    body: { userId },
  });
}

export function deleteTask(taskId: string): Promise<unknown> {
  return request(`/api/task/${taskId}`, { method: "DELETE" });
}

export function listComments(taskId: string): Promise<Comment[]> {
  return request(`/api/comment/${taskId}`) as Promise<Comment[]>;
}

export function createComment(
  taskId: string,
  content: string,
): Promise<unknown> {
  return request(`/api/comment/${taskId}`, {
    method: "POST",
    body: { content },
  });
}

export function listMembers(workspaceId: string): Promise<Member[]> {
  return request(`/api/workspace/${workspaceId}/members`) as Promise<Member[]>;
}

export function listSprints(projectId: string): Promise<Sprint[]> {
  return request(`/api/sprint/project/${projectId}`) as Promise<Sprint[]>;
}

export function listSprintTasks(sprintId: string): Promise<SprintTask[]> {
  return request(`/api/sprint/${sprintId}/tasks`) as Promise<SprintTask[]>;
}

export function listFolders(projectId: string): Promise<FolderItem[]> {
  return request(`/api/document/folders/${projectId}`) as Promise<FolderItem[]>;
}

export function listDocuments(
  projectId: string,
  folderId: string | null,
): Promise<DocumentItem[]> {
  return request(`/api/document/list/${projectId}`, {
    query: folderId ? { folderId } : undefined,
  }) as Promise<DocumentItem[]>;
}

type UploadFile = {
  uri: string;
  name: string;
  mimeType: string | null;
};

export function uploadDocument(
  projectId: string,
  file: UploadFile,
  folderId: string | null,
): Promise<unknown> {
  const form = new FormData();
  const nativeFile = {
    uri: file.uri,
    name: file.name,
    type: file.mimeType ?? "application/octet-stream",
  };
  form.append("file", nativeFile as unknown as Blob);
  form.append("target", "server");
  if (folderId) form.append("folderId", folderId);
  return request(`/api/document/${projectId}`, { method: "POST", form });
}

export async function downloadDocument(
  documentId: string,
  fallbackName: string,
): Promise<string> {
  const session = requireSession();
  const response = await fetch(
    buildApiUrl(session.serverUrl, `/api/document/${documentId}/download`),
    {
      headers: {
        Accept: "*/*",
        ...authHeaders(session.credential),
      },
    },
  );
  if (!response.ok) {
    const payload = await readBody(response);
    throw new ApiError(
      messageFromBody(payload, response.status),
      response.status,
    );
  }

  const filename = safeDownloadName(
    filenameFromContentDisposition(
      response.headers.get("Content-Disposition"),
    ) ?? fallbackName,
  );
  const bytes = new Uint8Array(await response.arrayBuffer());
  const directory = new Directory(Paths.cache, "kaneo-documents");
  if (!directory.exists) {
    directory.create({ intermediates: true, idempotent: true });
  }
  const file = new File(directory, filename);
  if (file.exists) file.delete();
  file.create();
  file.write(bytes);

  if (await Sharing.isAvailableAsync()) {
    try {
      await Sharing.shareAsync(file.uri, {
        mimeType: response.headers.get("Content-Type") ?? undefined,
        dialogTitle: filename,
      });
    } catch {
      // Đóng hộp chia sẻ không làm mất tệp đã lưu trong bộ nhớ đệm.
    }
  }
  return filename;
}

export function listNotifications(): Promise<NotificationItem[]> {
  return request("/api/notification") as Promise<NotificationItem[]>;
}

export function markNotificationRead(id: string): Promise<unknown> {
  return request(`/api/notification/${id}/read`, { method: "PATCH" });
}

export function markAllNotificationsRead(): Promise<unknown> {
  return request("/api/notification/read-all", { method: "PATCH" });
}
