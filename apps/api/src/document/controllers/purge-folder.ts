import { eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { documentTable, folderTable } from "../../database/schema";
import { storage } from "../../storage";

// Permanently deletes a folder and its contents (purge from Trash). Deleting the
// folder cascades (DB) to child folders + document rows, but NOT to the files on
// disk. We collect every descendant document's storageKey first, delete the DB
// rows, then best-effort remove the blobs — otherwise we leak files.
async function purgeFolder(id: string) {
  const [folder] = await db
    .select({ id: folderTable.id, projectId: folderTable.projectId })
    .from(folderTable)
    .where(eq(folderTable.id, id))
    .limit(1);
  if (!folder) {
    throw new HTTPException(404, { message: "Folder not found" });
  }

  // Build the subtree (this folder + all descendants) from the project's folders.
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
  const subtree = new Set<string>([id]);
  const stack = [id];
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

  // Collect storage keys of every document in the subtree.
  const docs = await db
    .select({ storageKey: documentTable.storageKey })
    .from(documentTable)
    .where(inArray(documentTable.folderId, [...subtree]));
  const storageKeys = docs.map((d) => d.storageKey);

  // Delete the folder row — the DB self-FK + document FK cascade removes the
  // rest of the subtree and its document rows.
  await db.delete(folderTable).where(eq(folderTable.id, id));

  // Best-effort blob cleanup; the DB is the source of truth.
  await Promise.all(
    storageKeys.map((key) => storage.delete(key).catch(() => {})),
  );

  return { success: true };
}

export default purgeFolder;
