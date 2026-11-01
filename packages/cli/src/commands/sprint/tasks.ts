import { Effect } from "effect";
import { Argument, Command } from "effect/cli";
import { listSprintTasks } from "../../api/sprints.js";
import { emit } from "../../output/emit.js";
import { withSpinner } from "../../output/spinner.js";
import { ApiLayer } from "../api-layer.js";

const sprintArgument = Argument.String("sprint").pipe(
  Argument.withDescription("Sprint id"),
);

export const runSprintTasks = Effect.fn("command.sprint.tasks")(function* (
  sprintId: string,
) {
  const tasks = yield* withSpinner("Loading sprint tasks")(
    listSprintTasks(sprintId),
  );
  yield* emit(tasks, () =>
    tasks.length === 0
      ? ["No tasks in this sprint."]
      : tasks.map(
          (task) =>
            `${task.number ?? "-"}  ${task.status ?? "no-status"}  ${task.title}`,
        ),
  );
});

export const sprintTasks = Command.make(
  "tasks",
  { sprint: sprintArgument },
  ({ sprint }) => runSprintTasks(sprint),
).pipe(
  Command.withDescription("List tasks in a sprint"),
  Command.provide(ApiLayer),
);
