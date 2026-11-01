import type { Option } from "effect";
import { Effect } from "effect";
import { Command } from "effect/cli";
import { listProjectSprints } from "../../api/sprints.js";
import { emit } from "../../output/emit.js";
import { withSpinner } from "../../output/spinner.js";
import {
  resolveProject,
  resolveWorkspaceId,
} from "../../services/selection.js";
import { ApiLayer } from "../api-layer.js";
import { projectFlag } from "../column/project-flag.js";

export const runSprintList = Effect.fn("command.sprint.list")(
  function* (options: { readonly project: Option.Option<string> }) {
    const workspaceId = yield* resolveWorkspaceId();
    const project = yield* resolveProject(workspaceId, options.project);
    const sprints = yield* withSpinner(`Loading ${project.name} sprints`)(
      listProjectSprints(project.id),
    );
    yield* emit(sprints, () =>
      sprints.length === 0
        ? ["No sprints."]
        : sprints.map(
            (sprint) =>
              `${sprint.state.padEnd(9)} ${sprint.name}  ${sprint.id}`,
          ),
    );
  },
);

export const sprintList = Command.make(
  "list",
  { project: projectFlag },
  (options) => runSprintList(options),
).pipe(
  Command.withDescription("List sprints in a project"),
  Command.provide(ApiLayer),
);
