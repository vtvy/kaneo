import { connectJira, type JiraCredentials } from "./jira/index.js";
import { connectPlanka, type PlankaCredentials } from "./planka/index.js";
import type { ConnectOptions, ImportSource } from "./types.js";

export { normalizeBaseUrl, SourceHttpError } from "./http.js";
export { type JiraSite, parseJiraUrl } from "./jira/index.js";
export {
  SOURCE_PROJECT_KEY_MAX,
  sanitizeProjectKey,
  toProjectKey,
  uniqueKey,
} from "./keys.js";
export type * from "./types.js";
export type { JiraCredentials, PlankaCredentials };

export const IMPORT_SOURCE_IDS = ["planka", "jira"] as const;

export type ImportSourceId = (typeof IMPORT_SOURCE_IDS)[number];

export type ImportCredentials = {
  planka: PlankaCredentials;
  jira: JiraCredentials;
};

export type ImportConnection = {
  [Source in ImportSourceId]: { source: Source } & ImportCredentials[Source];
}[ImportSourceId];

export function connectSource(
  connection: ImportConnection,
  options: ConnectOptions = {},
): Promise<ImportSource> {
  switch (connection.source) {
    case "planka":
      return connectPlanka(connection, options);
    case "jira":
      return connectJira(connection, options);
  }
}
