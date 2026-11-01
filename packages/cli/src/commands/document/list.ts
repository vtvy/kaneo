import type { Option } from "effect";
import { Effect } from "effect";
import { Command } from "effect/cli";
import {
  listProjectDocuments,
  listProjectFolders,
} from "../../api/documents.js";
import { emit } from "../../output/emit.js";
import { withSpinner } from "../../output/spinner.js";
import {
  resolveProject,
  resolveWorkspaceId,
} from "../../services/selection.js";
import { ApiLayer } from "../api-layer.js";
import { projectFlag } from "../column/project-flag.js";

export const runDocumentList = Effect.fn("command.document.list")(
  function* (options: { readonly project: Option.Option<string> }) {
    const workspaceId = yield* resolveWorkspaceId();
    const project = yield* resolveProject(workspaceId, options.project);
    const folders = yield* withSpinner(`Loading ${project.name} folders`)(
      listProjectFolders(project.id),
    );
    const documents = yield* withSpinner(`Loading ${project.name} documents`)(
      listProjectDocuments(project.id),
    );
    const payload = { folders, documents };
    yield* emit(payload, () => {
      const folderLines =
        folders.length === 0
          ? ["No folders."]
          : folders.map((folder) => `folder  ${folder.name}  ${folder.id}`);
      const documentLines =
        documents.length === 0
          ? ["No documents in the project root."]
          : documents.map(
              (document) =>
                `file    ${document.source ?? "server"}  ${document.name}  ${document.id}`,
            );
      return [...folderLines, ...documentLines];
    });
  },
);

export const documentList = Command.make(
  "list",
  { project: projectFlag },
  (options) => runDocumentList(options),
).pipe(
  Command.withDescription("List folders and root documents in a project"),
  Command.provide(ApiLayer),
);
