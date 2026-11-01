import { Command } from "effect/cli";
import { sprintBacklog } from "./backlog.js";
import { sprintList } from "./list.js";
import { sprintTasks } from "./tasks.js";

export const sprint = Command.make("sprint").pipe(
  Command.withDescription("List sprints, sprint tasks and the backlog"),
  Command.withSubcommands([sprintList, sprintTasks, sprintBacklog]),
);
