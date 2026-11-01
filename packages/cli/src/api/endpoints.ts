import { Effect } from "effect";
import { NotFound } from "../errors/errors.js";
import type { Credentials } from "../services/session.js";
import { fromOrganizations } from "./from-organizations.js";
import { KaneoApi, type Query } from "./kaneo-api.js";
import {
  AssignedTasks,
  BoardPage,
  ColumnList,
  CurrentUser,
  OrganizationList,
  Project,
  ProjectList,
  WorkspaceList,
  WorkspaceMemberList,
} from "./schemas.js";

export const getCurrentUser = Effect.fnUntraced(function* (
  credentials?: Credentials,
) {
  const api = yield* KaneoApi;
  return yield* api.request("GET", "/api/user/me", CurrentUser, {
    credentials,
  });
});

export const listWorkspaces = Effect.fnUntraced(function* (
  credentials?: Credentials,
) {
  const api = yield* KaneoApi;
  return yield* api
    .request("GET", "/api/workspace", WorkspaceList, { credentials })
    .pipe(
      Effect.catchTag("NotFound", () =>
        api
          .request("GET", "/api/auth/organization/list", OrganizationList, {
            credentials,
          })
          .pipe(Effect.map(fromOrganizations)),
      ),
    );
});

export const getWorkspace = Effect.fnUntraced(function* (workspaceId: string) {
  const workspaces = yield* listWorkspaces();
  const found = workspaces.find((workspace) => workspace.id === workspaceId);
  if (found) return found;
  return yield* Effect.fail(new NotFound({ message: "Workspace not found" }));
});

export const listProjects = Effect.fnUntraced(function* (workspaceId: string) {
  const api = yield* KaneoApi;
  return yield* api.request("GET", "/api/project", ProjectList, {
    query: { workspaceId },
  });
});

export const getBoardPage = Effect.fnUntraced(function* (
  projectId: string,
  query: Query,
) {
  const api = yield* KaneoApi;
  return yield* api.request(
    "GET",
    `/api/task/tasks/${encodeURIComponent(projectId)}`,
    BoardPage,
    { query },
  );
});

export const listAssignedTasks = Effect.fnUntraced(function* (
  workspaceId: string,
) {
  const api = yield* KaneoApi;
  return yield* api.request("GET", "/api/task/assigned", AssignedTasks, {
    query: { workspaceId },
  });
});

export const getProject = Effect.fnUntraced(function* (projectId: string) {
  const api = yield* KaneoApi;
  return yield* api.request(
    "GET",
    `/api/project/${encodeURIComponent(projectId)}`,
    Project,
  );
});

export const listColumns = Effect.fnUntraced(function* (projectId: string) {
  const api = yield* KaneoApi;
  return yield* api.request(
    "GET",
    `/api/column/${encodeURIComponent(projectId)}`,
    ColumnList,
  );
});

export const listMembers = Effect.fnUntraced(function* (workspaceId: string) {
  const api = yield* KaneoApi;
  return yield* api.request(
    "GET",
    `/api/workspace/${encodeURIComponent(workspaceId)}/members`,
    WorkspaceMemberList,
  );
});
