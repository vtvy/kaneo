import { createSlug } from "./create-slug";

const RANDOM_SUFFIX_LENGTH = 12;

export function createWorkspaceBaseSlug(value: string): string {
  return createSlug(value) || "workspace";
}

/** Collision suffix for workspace URLs — not a secret, so no Web Crypto. */
export function createRandomWorkspaceSlugSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
    .replace(/[^0-9a-z]/g, "")
    .slice(-RANDOM_SUFFIX_LENGTH)
    .padStart(RANDOM_SUFFIX_LENGTH, "0");
}

export function createUniqueWorkspaceSlug(
  value: string,
  existingSlugs: Iterable<string | null | undefined>,
): string {
  const baseSlug = createWorkspaceBaseSlug(value);
  const usedSlugs = new Set(
    Array.from(existingSlugs, (slug) => slug?.toLowerCase()).filter(Boolean),
  );

  if (!usedSlugs.has(baseSlug.toLowerCase())) {
    return baseSlug;
  }

  let slug = `${baseSlug}-${createRandomWorkspaceSlugSuffix()}`;

  while (usedSlugs.has(slug.toLowerCase())) {
    slug = `${baseSlug}-${createRandomWorkspaceSlugSuffix()}`;
  }

  return slug;
}

export type WorkspaceCreateErrorCode =
  | "ORGANIZATION_ALREADY_EXISTS"
  | "ORGANIZATION_SLUG_ALREADY_TAKEN"
  | "GENERIC";

export class WorkspaceCreateError extends Error {
  code: WorkspaceCreateErrorCode;

  constructor(message: string, code: WorkspaceCreateErrorCode = "GENERIC") {
    super(message);
    this.name = "WorkspaceCreateError";
    this.code = code;
  }
}

function readErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  if ("code" in error && typeof error.code === "string") return error.code;
  return undefined;
}

function readErrorMessage(error: unknown): string | undefined {
  if (error instanceof Error && error.message) return error.message;
  if (!error || typeof error !== "object") return undefined;
  if ("message" in error && typeof error.message === "string") {
    return error.message;
  }
  return undefined;
}

export function isWorkspaceSlugCollisionError(error: unknown): boolean {
  const code = readErrorCode(error);
  if (
    code === "ORGANIZATION_ALREADY_EXISTS" ||
    code === "ORGANIZATION_SLUG_ALREADY_TAKEN"
  ) {
    return true;
  }

  const message = readErrorMessage(error)?.toLowerCase() ?? "";
  return (
    message.includes("already exists") ||
    message.includes("slug already taken") ||
    message.includes("workspace exists")
  );
}

export function toWorkspaceCreateError(error: unknown): WorkspaceCreateError {
  if (error instanceof WorkspaceCreateError) return error;

  const code = readErrorCode(error);
  const message = readErrorMessage(error) || "Failed to create workspace";

  if (
    code === "ORGANIZATION_ALREADY_EXISTS" ||
    code === "ORGANIZATION_SLUG_ALREADY_TAKEN" ||
    isWorkspaceSlugCollisionError(error)
  ) {
    return new WorkspaceCreateError(
      message,
      code === "ORGANIZATION_SLUG_ALREADY_TAKEN"
        ? "ORGANIZATION_SLUG_ALREADY_TAKEN"
        : "ORGANIZATION_ALREADY_EXISTS",
    );
  }

  return new WorkspaceCreateError(message, "GENERIC");
}
