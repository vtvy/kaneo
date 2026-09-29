import { and, eq, inArray, isNotNull } from "drizzle-orm";
import db from "../../database";
import { documentTable, folderTable } from "../../database/schema";
import { storage } from "../../storage";

// Permanently purges everything in a project's Trash: all trashed folders (with
// their full subtrees, via DB cascade) and all trashed documents. Blob cleanup
// is best-effort; the DB is the source of truth.
async function emptyTrash(projectId: string) {
  const projectFolders = await db
    .select({
      id: folderTable.id,
      parentId: folderTable.parentId,
      deletedAt: folderTable.deletedAt,
    })
    .from(folderTable)
    .where(eq(folderTable.projectId, projectId));

  const childrenOf = new Map<string, string[]>();
  for (const f of projectFolders) {
    if (!f.parentId) continue;
    const list = childrenOf.get(f.parentId) ?? [];
    list.push(f.id);
    childrenOf.set(f.parentId, list);
  }

  // Subtree of every trashed folder (the trashed roots + all descendants,
  // trashed or merely hidden) — needed to collect blob keys before the cascade.
  const subtree = new Set<string>();
  const stack = projectFolders.filter((f) => f.deletedAt).map((f) => f.id);
  for (const id of stack) subtree.add(id);
  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;
    for (const child of childrenOf.get(current) ?? []) {
      if (!subtree.has(child)) {
        subtree.add(child);
        stack.push(child);
      }
    }
  }

  // Storage keys to clean up: docs under any trashed subtree folder, plus any
  // individually trashed doc (root-level or inside a still-active folder).
  const storageKeys = new Set<string>();
  if (subtree.size > 0) {
    const subtreeDocs = await db
      .select({ storageKey: documentTable.storageKey })
      .from(documentTable)
      .where(inArray(documentTable.folderId, [...subtree]));
    for (const d of subtreeDocs) storageKeys.add(d.storageKey);
  }
  const trashedDocs = await db
    .select({ storageKey: documentTable.storageKey })
    .from(documentTable)
    .where(
      and(
        eq(documentTable.projectId, projectId),
        isNotNull(documentTable.deletedAt),
      ),
    );
  for (const d of trashedDocs) storageKeys.add(d.storageKey);

  await db.transaction(async (tx) => {
    // Deleting trashed folders cascades to descendant folders + their docs.
    await tx
      .delete(folderTable)
      .where(
        and(
          eq(folderTable.projectId, projectId),
          isNotNull(folderTable.deletedAt),
        ),
      );
    // Remaining individually-trashed docs (folder still active or root-level).
    await tx
      .delete(documentTable)
      .where(
        and(
          eq(documentTable.projectId, projectId),
          isNotNull(documentTable.deletedAt),
        ),
      );
  });

  await Promise.all(
    [...storageKeys].map((key) => storage.delete(key).catch(() => {})),
  );

  return { success: true };
}

export default emptyTrash;
