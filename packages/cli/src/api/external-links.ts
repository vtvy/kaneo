import { Effect, Schema } from "effect";
import { InvalidArgument } from "../errors/errors.js";
import { KaneoApi } from "./kaneo-api.js";

const NullableString = Schema.NullOr(Schema.String);

export const ExternalLink = Schema.Struct({
  id: Schema.String,
  taskId: Schema.String,
  integrationId: NullableString,
  resourceType: Schema.String,
  url: Schema.String,
  title: NullableString,
  createdAt: Schema.String,
  integration: Schema.optionalKey(
    Schema.NullOr(Schema.Struct({ id: Schema.String, type: Schema.String })),
  ),
});
export type ExternalLink = typeof ExternalLink.Type;

const ExternalLinkList = Schema.Array(ExternalLink);

function linksPath(taskId: string): string {
  return `/api/external-link/task/${encodeURIComponent(taskId)}`;
}

export const listExternalLinks = Effect.fnUntraced(function* (taskId: string) {
  const api = yield* KaneoApi;
  return yield* api.request("GET", linksPath(taskId), ExternalLinkList);
});

export const createExternalLink = Effect.fnUntraced(function* (
  _taskId: string,
  _body: { readonly url: string; readonly title?: string },
) {
  return yield* new InvalidArgument({
    message: "This server cannot attach a link to a task.",
    hint: "Links are created by integrations. kaneo task link list still shows the ones already on the task.",
  });
});

export const deleteExternalLink = Effect.fnUntraced(function* (
  _taskId: string,
  _linkId: string,
) {
  return yield* new InvalidArgument({
    message: "This server cannot remove a task link.",
    hint: "Links come from integrations. Remove the link there, or disconnect the integration.",
  });
});
