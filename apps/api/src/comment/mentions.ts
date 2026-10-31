import { and, eq, inArray } from "drizzle-orm";
import db from "../database";
import { workspaceUserTable } from "../database/schema";
import { canInProject } from "../project-rbac/can-in-project";
import { parseMentionIds } from "../utils/parse-mentions";

// Cap on how many users a single comment can @mention, to avoid notification
// spam / abuse via a crafted comment body.
export const MAX_MENTIONS = 50;

/**
 * Resolve who should be notified for the @mentions in a comment body.
 *
 * Mentioned ids are parsed from the stored content (never taken from the
 * client separately). The author is never included, ids listed in
 * `excludeIds` (e.g. already mentioned before an edit) are skipped, and only
 * members of the task's workspace who can read the project are kept.
 */
export async function resolveMentionRecipients({
  content,
  authorId,
  workspaceId,
  projectId,
  excludeIds = [],
}: {
  content: string | null | undefined;
  authorId: string;
  workspaceId: string;
  projectId: string;
  excludeIds?: string[];
}): Promise<string[]> {
  const skip = new Set([authorId, ...excludeIds]);
  const candidateIds = parseMentionIds(content)
    .filter((id) => !skip.has(id))
    .slice(0, MAX_MENTIONS);

  if (candidateIds.length === 0) return [];

  const members = await db
    .select({ userId: workspaceUserTable.userId })
    .from(workspaceUserTable)
    .where(
      and(
        eq(workspaceUserTable.workspaceId, workspaceId),
        inArray(workspaceUserTable.userId, candidateIds),
      ),
    );
  const memberSet = new Set(members.map((m) => m.userId));

  const recipients: string[] = [];
  for (const id of candidateIds) {
    if (!memberSet.has(id)) continue;
    if (await canInProject(id, projectId, "item", "read")) {
      recipients.push(id);
    }
  }
  return recipients;
}
