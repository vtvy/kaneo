import { Effect, Schema } from "effect";
import { KaneoApi } from "./kaneo-api.js";

const NullableString = Schema.NullOr(Schema.String);

export const SprintSummary = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  state: Schema.String,
  startDate: Schema.optionalKey(NullableString),
  endDate: Schema.optionalKey(NullableString),
});
export type SprintSummary = typeof SprintSummary.Type;

export const SprintList = Schema.Array(SprintSummary);

export const BacklogTask = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  number: Schema.NullOr(Schema.Number),
  status: NullableString,
});
export type BacklogTask = typeof BacklogTask.Type;

export const BacklogTaskList = Schema.Array(BacklogTask);

export const listProjectSprints = Effect.fnUntraced(function* (
  projectId: string,
) {
  const api = yield* KaneoApi;
  return yield* api.request(
    "GET",
    `/api/sprint/project/${encodeURIComponent(projectId)}`,
    SprintList,
  );
});

export const listSprintTasks = Effect.fnUntraced(function* (sprintId: string) {
  const api = yield* KaneoApi;
  return yield* api.request(
    "GET",
    `/api/sprint/${encodeURIComponent(sprintId)}/tasks`,
    BacklogTaskList,
  );
});

export const listBacklogTasks = Effect.fnUntraced(function* (
  projectId: string,
) {
  const api = yield* KaneoApi;
  return yield* api.request(
    "GET",
    `/api/sprint/project/${encodeURIComponent(projectId)}/backlog`,
    BacklogTaskList,
  );
});
