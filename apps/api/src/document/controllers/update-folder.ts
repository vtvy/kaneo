import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { folderTable } from "../../database/schema";

// Rename and/or move a folder. Metadata only — never touches blobs.
async function updateFolder({
  id,
  name,
  parentId,
}: {
  id: string;
  name?: string;
  parentId?: string | null;
}) {
  const [folder] = await db
    .select()
    .from(folderTable)
    .where(eq(folderTable.id, id))
    .limit(1);
  if (!folder) {
    throw new HTTPException(404, { message: "Folder not found" });
  }

  const updates: { name?: string; parentId?: string | null } = {};

  if (name !== undefined) {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new HTTPException(400, { message: "Folder name is required" });
    }
    updates.name = trimmed;
  }

  if (parentId !== undefined) {
    if (parentId === id) {
      throw new HTTPException(400, {
        message: "A folder cannot be its own parent",
      });
    }

    if (parentId !== null) {
      const [parent] = await db
        .select({ id: folderTable.id })
        .from(folderTable)
        .where(
          and(
            eq(folderTable.id, parentId),
            eq(folderTable.projectId, folder.projectId),
          ),
        )
        .limit(1);
      if (!parent) {
        throw new HTTPException(400, { message: "Parent folder not found" });
      }

      // Prevent cycles: the new parent must not be a descendant of this folder.
      const projectFolders = await db
        .select({ id: folderTable.id, parentId: folderTable.parentId })
        .from(folderTable)
        .where(eq(folderTable.projectId, folder.projectId));
      const childrenOf = new Map<string, string[]>();
      for (const f of projectFolders) {
        if (!f.parentId) continue;
        const list = childrenOf.get(f.parentId) ?? [];
        list.push(f.id);
        childrenOf.set(f.parentId, list);
      }
      const descendants = new Set<string>();
      const stack = [id];
      while (stack.length) {
        const current = stack.pop();
        if (!current) continue;
        for (const child of childrenOf.get(current) ?? []) {
          if (!descendants.has(child)) {
            descendants.add(child);
            stack.push(child);
          }
        }
      }
      if (descendants.has(parentId)) {
        throw new HTTPException(400, {
          message: "Cannot move a folder into one of its own subfolders",
        });
      }
    }

    updates.parentId = parentId;
  }

  if (Object.keys(updates).length === 0) {
    return folder;
  }

  const [updated] = await db
    .update(folderTable)
    .set(updates)
    .where(eq(folderTable.id, id))
    .returning();

  return updated;
}

export default updateFolder;
