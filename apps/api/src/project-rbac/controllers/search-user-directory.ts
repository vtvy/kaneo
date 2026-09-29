import { and, eq, ilike, isNull, notInArray, or, sql } from "drizzle-orm";
import db from "../../database";
import { projectMemberTable, userTable } from "../../database/schema";

const DEFAULT_LIMIT = 8;

type DirectoryUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

/**
 * Search registered users who are not already members of this project.
 * Used by the Add Member autocomplete.
 */
async function searchProjectUserDirectory(
  projectId: string,
  query: string,
  limit = DEFAULT_LIMIT,
): Promise<DirectoryUser[]> {
  const memberRows = await db
    .select({ userId: projectMemberTable.userId })
    .from(projectMemberTable)
    .where(eq(projectMemberTable.projectId, projectId));

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

export default searchProjectUserDirectory;
