export type PermissionStatements = Record<string, readonly string[]>;

export type ProjectAccess = {
  isOwner: boolean;
  statements: PermissionStatements;
};

export function parseProjectAccess(body: unknown): ProjectAccess {
  if (!body || typeof body !== "object") {
    return { isOwner: false, statements: {} };
  }

  const record = body as Record<string, unknown>;
  const statements: Record<string, string[]> = {};
  if (record.statements && typeof record.statements === "object") {
    for (const [resource, actions] of Object.entries(
      record.statements as Record<string, unknown>,
    )) {
      if (!Array.isArray(actions)) continue;
      statements[resource] = actions.filter(
        (action): action is string => typeof action === "string",
      );
    }
  }

  return {
    isOwner: record.isOwner === true,
    statements,
  };
}

export function can(
  access: ProjectAccess | null | undefined,
  resource: string,
  action: string,
): boolean {
  if (!access) return false;
  if (access.isOwner) return true;
  return access.statements[resource]?.includes(action) ?? false;
}

export function canEditOwnComment(
  authorId: string | null | undefined,
  currentUserId: string | null | undefined,
): boolean {
  return Boolean(authorId && currentUserId && authorId === currentUserId);
}

export function canAssignTask(
  access: ProjectAccess | null | undefined,
  reporterId: string | null | undefined,
  currentUserId: string | null | undefined,
): boolean {
  if (can(access, "item", "assign")) return true;
  if (!access) return false;
  return Boolean(currentUserId && reporterId && currentUserId === reporterId);
}
