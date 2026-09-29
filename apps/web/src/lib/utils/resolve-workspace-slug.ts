import { authClient } from "@/lib/auth-client";
import {
  createRandomWorkspaceSlugSuffix,
  createWorkspaceBaseSlug,
  isWorkspaceSlugCollisionError,
  toWorkspaceCreateError,
  WorkspaceCreateError,
} from "@/lib/utils/create-workspace-slug";

const MAX_SLUG_ATTEMPTS = 8;

/** Prefer check-slug (global uniqueness) over the caller's own org list. */
export async function resolveAvailableWorkspaceSlug(
  name: string,
  preferredSlug?: string,
): Promise<string> {
  const baseSlug = preferredSlug?.trim() || createWorkspaceBaseSlug(name);
  const tried = new Set<string>();

  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt += 1) {
    const candidate =
      attempt === 0
        ? baseSlug
        : `${createWorkspaceBaseSlug(name)}-${createRandomWorkspaceSlugSuffix()}`;

    if (tried.has(candidate.toLowerCase())) continue;
    tried.add(candidate.toLowerCase());

    // Call checkSlug directly — do NOT use .bind() on authClient.organization.
    // Better Auth's dynamic path proxy intercepts property access (including
    // "bind"), which produced bogus requests like
    // /organization/fetch-options/method/to-upper-case and "c is not a function".
    const { data, error } = await authClient.organization.checkSlug({
      slug: candidate,
    });

    if (data?.status === true) {
      return candidate;
    }

    if (error && !isWorkspaceSlugCollisionError(error)) {
      throw toWorkspaceCreateError(error);
    }
  }

  throw new WorkspaceCreateError(
    "Could not find an available workspace URL. Try a different name.",
    "ORGANIZATION_ALREADY_EXISTS",
  );
}
