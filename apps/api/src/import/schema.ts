import * as v from "valibot";

const sourceUrl = v.pipe(
  v.string(),
  v.trim(),
  v.minLength(1),
  v.maxLength(2048),
);
const secret = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(4096));

// Credentials are used only for the request (or the import it starts) and are
// never stored, logged, or returned.
const plankaConnection = v.pipe(
  v.object({
    source: v.literal("planka"),
    url: sourceUrl,
    apiKey: v.optional(secret),
    username: v.optional(
      v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(256)),
    ),
    password: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(4096))),
  }),
  v.check(
    (connection) =>
      Boolean(connection.apiKey) ||
      Boolean(connection.username && connection.password),
    "Enter a PLANKA API key, or a username and password",
  ),
);

const jiraConnection = v.object({
  source: v.literal("jira"),
  url: sourceUrl,
  email: v.optional(
    v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(320)),
  ),
  apiToken: secret,
});

export const importConnectionSchema = v.variant("source", [
  plankaConnection,
  jiraConnection,
]);

export type ImportConnectionInput = v.InferOutput<
  typeof importConnectionSchema
>;

export const MAX_IMPORT_PROJECTS = 50;

export const listImportSourceProjectsBody = v.object({
  workspaceId: v.pipe(v.string(), v.minLength(1)),
  connection: importConnectionSchema,
});

export const startImportRunBody = v.object({
  workspaceId: v.pipe(v.string(), v.minLength(1)),
  connection: importConnectionSchema,
  projectIds: v.pipe(
    v.array(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(512))),
    v.minLength(1),
    v.maxLength(MAX_IMPORT_PROJECTS),
    v.check(
      (ids) => new Set(ids).size === ids.length,
      "Project IDs must be unique",
    ),
  ),
  includeComments: v.optional(v.boolean(), true),
});

export const workspaceIdParam = v.object({ workspaceId: v.string() });

export const importRunParam = v.object({
  workspaceId: v.string(),
  runId: v.string(),
});
