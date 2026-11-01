import { Effect, Schema } from "effect";
import { KaneoApi } from "./kaneo-api.js";

const NullableString = Schema.NullOr(Schema.String);

export const FolderSummary = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  parentId: Schema.optionalKey(NullableString),
});
export type FolderSummary = typeof FolderSummary.Type;

export const DocumentSummary = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  source: Schema.optionalKey(NullableString),
  folderId: Schema.optionalKey(NullableString),
});
export type DocumentSummary = typeof DocumentSummary.Type;

export const listProjectFolders = Effect.fnUntraced(function* (
  projectId: string,
) {
  const api = yield* KaneoApi;
  return yield* api.request(
    "GET",
    `/api/document/folders/${encodeURIComponent(projectId)}`,
    Schema.Array(FolderSummary),
  );
});

export const listProjectDocuments = Effect.fnUntraced(function* (
  projectId: string,
) {
  const api = yield* KaneoApi;
  return yield* api.request(
    "GET",
    `/api/document/list/${encodeURIComponent(projectId)}`,
    Schema.Array(DocumentSummary),
  );
});
