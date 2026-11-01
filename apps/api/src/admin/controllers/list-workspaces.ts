import {
  and,
  count,
  desc,
  ilike,
  isNotNull,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import db from "../../database";
import {
  projectTable,
  workspaceTable,
  workspaceUserTable,
} from "../../database/schema";
import { escapeLikePattern } from "../users/escape-like";

export type ListAdminWorkspacesInput = {
  search?: string;
  status?: "all" | "active" | "archived";
  page?: number;
  limit?: number;
};

async function listWorkspaces(input: ListAdminWorkspacesInput) {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const page = Math.max(input.page ?? 1, 1);
  const conditions = [];
  if (input.search?.trim()) {
    const pattern = `%${escapeLikePattern(input.search.trim())}%`;
    conditions.push(
      or(
        ilike(workspaceTable.name, pattern),
        ilike(workspaceTable.slug, pattern),
      ),
    );
  }
  if (input.status === "archived") {
    conditions.push(isNotNull(workspaceTable.archivedAt));
  } else if (input.status === "active") {
    conditions.push(isNull(workspaceTable.archivedAt));
  }
  const where = conditions.length ? and(...conditions) : undefined;

  const memberCount = db
    .select({ value: count() })
    .from(workspaceUserTable)
    .where(sql`${workspaceUserTable.workspaceId} = ${workspaceTable.id}`);
  const projectCount = db
    .select({ value: count() })
    .from(projectTable)
    .where(sql`${projectTable.workspaceId} = ${workspaceTable.id}`);

  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: workspaceTable.id,
        name: workspaceTable.name,
        slug: workspaceTable.slug,
        createdAt: workspaceTable.createdAt,
        archivedAt: workspaceTable.archivedAt,
        memberCount: sql<number>`(${memberCount})::int`,
        projectCount: sql<number>`(${projectCount})::int`,
      })
      .from(workspaceTable)
      .where(where)
      .orderBy(desc(workspaceTable.createdAt), workspaceTable.id)
      .limit(limit)
      .offset((page - 1) * limit),
    db.select({ value: count() }).from(workspaceTable).where(where),
  ]);

  return {
    workspaces: rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      archivedAt: row.archivedAt?.toISOString() ?? null,
    })),
    total: total?.value ?? 0,
  };
}

export default listWorkspaces;
