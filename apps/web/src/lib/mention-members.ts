import type { MentionMember } from "@/components/task/extensions/mention-list";

type WorkspaceMemberLike = {
  userId: string;
  role?: string | null;
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
};

/**
 * Members offered in the @mention suggestion list: workspace members who can
 * see the project. Workspace owners/admins have implicit project access;
 * everyone else must be a project member. When the project member list is
 * unavailable (still loading or not readable) all workspace members are
 * offered — the server only notifies users who can read the project anyway.
 */
export function getMentionableMembers(
  workspaceMembers: WorkspaceMemberLike[],
  projectMemberUserIds?: Iterable<string> | null,
): MentionMember[] {
  const projectMembers = projectMemberUserIds
    ? new Set(projectMemberUserIds)
    : null;

  return workspaceMembers
    .filter(
      (member) =>
        !projectMembers ||
        member.role === "owner" ||
        member.role === "admin" ||
        projectMembers.has(member.userId),
    )
    .map((member) => ({
      id: member.userId,
      label: member.user?.name || member.user?.email || member.userId,
      image: member.user?.image ?? null,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Case-insensitive filter of mention candidates for a typed `@query`. */
export function filterMentionMembers(
  members: MentionMember[],
  query: string,
  limit = 8,
): MentionMember[] {
  const normalized = query.trim().toLowerCase();
  const matches = normalized
    ? members.filter((member) =>
        member.label.toLowerCase().includes(normalized),
      )
    : members;
  return matches.slice(0, limit);
}
