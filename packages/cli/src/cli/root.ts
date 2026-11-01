import { Command } from "effect/cli";
import { apiCommand } from "../commands/api.js";
import { ApiLayer } from "../commands/api-layer.js";
import { column } from "../commands/column/index.js";
import { comment } from "../commands/comment/index.js";
import { contextCommand } from "../commands/context.js";
import { doctorCommand } from "../commands/doctor.js";
import { document } from "../commands/document/index.js";
import { field } from "../commands/field/index.js";
import { runHome } from "../commands/home.js";
import { invitation } from "../commands/invitation/index.js";
import { label } from "../commands/label/index.js";
import { linkCommand } from "../commands/link.js";
import { login } from "../commands/login.js";
import { logout } from "../commands/logout.js";
import { member } from "../commands/member/index.js";
import { notification } from "../commands/notification/index.js";
import { profile } from "../commands/profile/index.js";
import { project } from "../commands/project/index.js";
import { search } from "../commands/search.js";
import { sprint } from "../commands/sprint/index.js";
import { task } from "../commands/task/index.js";
import { time } from "../commands/time/index.js";
import { unlinkCommand } from "../commands/unlink.js";
import { whoami } from "../commands/whoami.js";
import { workflow } from "../commands/workflow/index.js";
import { workspace } from "../commands/workspace/index.js";
import { globalFlags } from "./global-flags.js";

export const root = Command.make("kaneo", {}, () => runHome()).pipe(
  Command.withDescription("Kaneo from your terminal"),
  Command.provide(ApiLayer),
  Command.withSubcommands([
    login,
    logout,
    whoami,
    contextCommand,
    linkCommand,
    unlinkCommand,
    profile,
    workspace,
    member,
    invitation,
    project,
    column,
    task,
    comment,
    label,
    time,
    field,
    workflow,
    notification,
    search,
    sprint,
    document,
    apiCommand,
    doctorCommand,
  ]),
  Command.withGlobalFlags(globalFlags),
);
