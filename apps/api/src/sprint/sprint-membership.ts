export type SprintMembership = {
  sprintId: string;
  addedAt: Date;
  removedAt: Date | null;
};

export type SprintMembershipPlan = {
  closeSprintIds: string[];
  reopenSprintId: string | null;
  insertSprintId: string | null;
};

// A task is in one sprint at a time. Past sprints stay as closed rows so the
// same task can show up in every sprint it passed through.
export function planSprintMembershipChange(
  memberships: SprintMembership[],
  nextSprintId: string | null,
): SprintMembershipPlan {
  const openSprintIds = memberships
    .filter((membership) => membership.removedAt == null)
    .map((membership) => membership.sprintId);
  const closeSprintIds = openSprintIds.filter(
    (sprintId) => sprintId !== nextSprintId,
  );
  const alreadyOpen =
    nextSprintId != null && openSprintIds.includes(nextSprintId);

  if (nextSprintId == null || alreadyOpen) {
    return { closeSprintIds, reopenSprintId: null, insertSprintId: null };
  }

  const visited = memberships.some(
    (membership) => membership.sprintId === nextSprintId,
  );

  return {
    closeSprintIds,
    reopenSprintId: visited ? nextSprintId : null,
    insertSprintId: visited ? null : nextSprintId,
  };
}
