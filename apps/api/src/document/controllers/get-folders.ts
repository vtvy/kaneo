import { asc, eq } from "drizzle-orm";
import db from "../../database";
import { folderTable } from "../../database/schema";

// Returns the flat list of ACTIVE folders for a project (ordered by name). A
// folder is active when neither it nor any ancestor is in the Trash; trashed
// folders only stamp themselves, so we walk the parent chain to hide their
// descendants. The frontend assembles the tree from parentId. Keeping it flat
// avoids a recursive query and is plenty for the small folder counts we expect.
async function getFolders(projectId: string) {
  const rows = await db
    .select({
      id: folderTable.id,
      projectId: folderTable.projectId,
      parentId: folderTable.parentId,
      name: folderTable.name,
      createdBy: folderTable.createdBy,
      createdAt: folderTable.createdAt,
      updatedAt: folderTable.updatedAt,
      deletedAt: folderTable.deletedAt,
    })
    .from(folderTable)
    .where(eq(folderTable.projectId, projectId))
    .orderBy(asc(folderTable.name));

  const byId = new Map(rows.map((r) => [r.id, r]));
  // A folder is hidden if it, or any ancestor, is trashed.
  const isHidden = (row: (typeof rows)[number]): boolean => {
    let current: (typeof rows)[number] | undefined = row;
    const seen = new Set<string>();
    while (current) {
      if (current.deletedAt) return true;
      if (!current.parentId || seen.has(current.id)) break;
      seen.add(current.id);
      current = byId.get(current.parentId);
    }
    return false;
  };

  return rows
    .filter((r) => !isHidden(r))
    .map((r) => ({
      id: r.id,
      projectId: r.projectId,
      parentId: r.parentId,
      name: r.name,
      createdBy: r.createdBy,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
}

export default getFolders;
