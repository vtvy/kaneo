import * as v from "valibot";
import { branchPatterns } from "../github/config";

export { branchPatterns };

export const gitlabConfigSchema = v.object({
  baseUrl: v.pipe(v.string(), v.url()),
  accessToken: v.pipe(v.string(), v.trim(), v.nonEmpty()),
  repositoryOwner: v.pipe(v.string(), v.trim(), v.nonEmpty()),
  repositoryName: v.pipe(v.string(), v.trim(), v.nonEmpty()),
  webhookSecret: v.optional(v.string()),
  branchPattern: v.optional(v.string()),
  customBranchRegex: v.optional(v.string()),
  commentTaskLinkOnGitlabIssue: v.optional(v.boolean()),
  statusTransitions: v.optional(
    v.object({
      onBranchPush: v.optional(v.string()),
      onPROpen: v.optional(v.string()),
      onPRMerge: v.optional(v.string()),
    }),
  ),
});

export type GitlabConfig = v.InferOutput<typeof gitlabConfigSchema>;

export async function validateGitlabConfig(
  config: unknown,
): Promise<{ valid: boolean; errors?: string[] }> {
  try {
    v.parse(gitlabConfigSchema, config);
    return { valid: true };
  } catch (error) {
    if (error instanceof v.ValiError) {
      return {
        valid: false,
        errors: error.issues.map((issue) => issue.message),
      };
    }
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : "Invalid config"],
    };
  }
}

export const defaultGitlabConfig: Partial<GitlabConfig> = {
  branchPattern: "{slug}-{number}",
  commentTaskLinkOnGitlabIssue: true,
  statusTransitions: {
    onBranchPush: "in-progress",
    onPROpen: "in-review",
    onPRMerge: "done",
  },
};

export function normalizeGitlabBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

/**
 * Validates a user-supplied GitLab base URL before any request is made: only
 * http(s), and no query, fragment or credentials (they would break the
 * `/api/v4` path appended later or leak into logs).
 */
export function assertValidGitlabBaseUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(normalizeGitlabBaseUrl(url));
  } catch {
    throw new Error("GitLab base URL is not a valid URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("GitLab base URL must use http or https");
  }
  if (parsed.search || parsed.hash || parsed.username || parsed.password) {
    throw new Error(
      "GitLab base URL must not contain a query, fragment, or credentials",
    );
  }
  return `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
}

/**
 * Normalizes a GitLab namespace, which may be a nested group path such as
 * `group/subgroup`. Relative segments are rejected.
 */
export function normalizeGitlabNamespace(namespace: string): string {
  const segments = namespace
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length === 0) {
    throw new Error("GitLab namespace is required");
  }
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error("GitLab namespace must not contain relative segments");
  }
  return segments.join("/");
}

/** The project path (last segment) is a single slug without slashes. */
export function normalizeGitlabProjectName(name: string): string {
  const trimmed = name.trim();
  if (
    !trimmed ||
    trimmed.includes("/") ||
    trimmed === "." ||
    trimmed === ".."
  ) {
    throw new Error("GitLab project path is invalid");
  }
  return trimmed;
}

/**
 * Splits `path_with_namespace` into namespace (possibly nested groups) and
 * project path, e.g. `a/b/c` -> { owner: "a/b", name: "c" }.
 */
export function splitGitlabProjectPath(pathWithNamespace: string): {
  owner: string;
  name: string;
} {
  const parts = pathWithNamespace.split("/").filter(Boolean);
  const name = parts.pop() ?? "";
  return { owner: parts.join("/"), name };
}

export function getDefaultGitlabConfig(
  baseUrl: string,
  accessToken: string,
  repositoryOwner: string,
  repositoryName: string,
  webhookSecret: string,
): GitlabConfig {
  return {
    baseUrl: normalizeGitlabBaseUrl(baseUrl),
    accessToken,
    repositoryOwner,
    repositoryName,
    webhookSecret,
    ...defaultGitlabConfig,
  };
}
