import { and, eq, ilike, isNull, notInArray, or, sql } from "drizzle-orm";
import db from "../../database";
import { userTable, workspaceUserTable } from "../../database/schema";

const DEFAULT_LIMIT = 8;

type DirectoryUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

/**
 * List / search users registered on this instance who are not already
 * members of the workspace. Used by the invite-member autocomplete.
 */
async function searchUserDirectory(
  workspaceId: string,
  query: string,
  limit = DEFAULT_LIMIT,
): Promise<DirectoryUser[]> {
  const memberRows = await db
    .select({ userId: workspaceUserTable.userId })
    .from(workspaceUserTable)
    .where(eq(workspaceUserTable.workspaceId, workspaceId));

  const memberIds = memberRows
    .map((row) => row.userId)
    .filter((id): id is string => Boolean(id));

  const notAnonymous = or(
    eq(userTable.isAnonymous, false),
    isNull(userTable.isAnonymous),
  );
  const notBanned = or(eq(userTable.banned, false), isNull(userTable.banned));

  const filters = [notAnonymous, notBanned];

  if (memberIds.length > 0) {
    filters.push(notInArray(userTable.id, memberIds));
  }

  const trimmed = query.trim();
  if (trimmed) {
    const pattern = `%${trimmed.replace(/[%_]/g, "\\$&")}%`;
    filters.push(
      or(ilike(userTable.email, pattern), ilike(userTable.name, pattern)),
    );
  }

  return db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      image: userTable.image,
    })
    .from(userTable)
    .where(and(...filters))
    .orderBy(sql`lower(${userTable.name})`)
    .limit(limit);
}

export default searchUserDirectory;
