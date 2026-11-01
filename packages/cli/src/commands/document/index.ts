import { Command } from "effect/cli";
import { documentList } from "./list.js";

export const document = Command.make("document").pipe(
  Command.withDescription("List project documents"),
  Command.withSubcommands([documentList]),
);
