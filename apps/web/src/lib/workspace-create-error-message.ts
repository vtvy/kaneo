import {
  toWorkspaceCreateError,
  type WorkspaceCreateErrorCode,
} from "@/lib/utils/create-workspace-slug";

type Translate = (key: string) => string;

const MESSAGE_KEYS: Record<WorkspaceCreateErrorCode, string> = {
  ORGANIZATION_ALREADY_EXISTS: "workspace:create.alreadyExists",
  ORGANIZATION_SLUG_ALREADY_TAKEN: "workspace:create.alreadyExists",
  GENERIC: "workspace:create.error",
};

/** Map better-auth / slug collision errors to a user-facing i18n message. */
export function workspaceCreateErrorMessage(
  error: unknown,
  t: Translate,
): string {
  const mapped = toWorkspaceCreateError(error);
  if (mapped.code === "GENERIC" && mapped.message.trim()) {
    // Prefer server-provided reason (e.g. checkWorkspaceName) when present.
    const looksLikeJson =
      mapped.message.trim().startsWith("{") ||
      mapped.message.includes('"code"');
    if (!looksLikeJson) {
      return mapped.message;
    }
  }
  return t(MESSAGE_KEYS[mapped.code]);
}
