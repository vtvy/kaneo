import { Effect, Schema } from "effect";
import { NotFound } from "../errors/errors.js";
import type { Credentials } from "../services/session.js";
import { fromOrganizations } from "./from-organizations.js";
import { KaneoApi, type Query } from "./kaneo-api.js";
import {
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

const MyTask = Schema.Struct({
  id: Schema.String,
  projectId: Schema.String,
  number: Schema.NullOr(Schema.Number),
  title: Schema.String,
  status: Schema.String,
  columnName: Schema.NullOr(Schema.String),
  priority: Schema.String,
  dueDate: Schema.NullOr(Schema.String),
  projectName: Schema.String,
  projectSlug: Schema.String,
});

type MyTaskRow = typeof MyTask.Type;

export function toAssignedTasks(tasks: ReadonlyArray<MyTaskRow>) {
  return {
    tasks: tasks.map((task) => ({
      id: task.id,
      projectId: task.projectId,
      number: task.number,
      title: task.title,
      status: task.status,
      statusName: task.columnName,
      priority: task.priority,
      dueDate: task.dueDate,
      projectName: task.projectName,
      projectSlug: task.projectSlug,
    })),
    total: tasks.length,
  };
}

export const listAssignedTasks = Effect.fnUntraced(function* (
  workspaceId: string,
) {
  const api = yield* KaneoApi;
  const tasks = yield* api.request(
    "GET",
    `/api/task/my/${encodeURIComponent(workspaceId)}`,
    Schema.Array(MyTask),
    { query: { scope: "assigned", open: "true" } },
  );
  return toAssignedTasks(tasks);
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
