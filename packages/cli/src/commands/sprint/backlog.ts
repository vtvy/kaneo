import type { Option } from "effect";
import { Effect } from "effect";
import { Command } from "effect/cli";
import { listBacklogTasks } from "../../api/sprints.js";
import { emit } from "../../output/emit.js";
import { withSpinner } from "../../output/spinner.js";
import {
  resolveProject,
  resolveWorkspaceId,
} from "../../services/selection.js";
import { ApiLayer } from "../api-layer.js";
import { projectFlag } from "../column/project-flag.js";

export const runSprintBacklog = Effect.fn("command.sprint.backlog")(
  function* (options: { readonly project: Option.Option<string> }) {
    const workspaceId = yield* resolveWorkspaceId();
    const project = yield* resolveProject(workspaceId, options.project);
    const tasks = yield* withSpinner(`Loading ${project.name} backlog`)(
      listBacklogTasks(project.id),
    );
    yield* emit(tasks, () =>
      tasks.length === 0
        ? ["Backlog is empty."]
        : tasks.map(
            (task) =>
              `${task.number ?? "-"}  ${task.status ?? "no-status"}  ${task.title}`,
          ),
    );
  },
);

export const sprintBacklog = Command.make(
  "backlog",
  { project: projectFlag },
  (options) => runSprintBacklog(options),
).pipe(
  Command.withDescription("List tasks that are not in a sprint"),
  Command.provide(ApiLayer),
);
