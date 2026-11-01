import { eq, inArray } from "drizzle-orm";
import type { DbOrTx } from "../admin/audit/record-admin-action";
import { assetTable, documentTable, projectTable } from "../database/schema";
import { prepareDocumentBlobDeletion } from "../document/providers";
import { deleteS3Keys } from "./cleanup-assets";

/** Capture keys before cascading deletes remove their database records. */
export async function collectContainerStorage(
  tx: DbOrTx,
  scope: { projectId: string } | { workspaceId: string },
) {
  const projects = await tx
    .select({ id: projectTable.id })
    .from(projectTable)
    .where(
      "projectId" in scope
        ? eq(projectTable.id, scope.projectId)
        : eq(projectTable.workspaceId, scope.workspaceId),
    )
    .for("update");
  const ids = projects.map((project) => project.id);
  if (ids.length === 0) return { assets: [], deletions: [] };
  const assets = await tx
    .select({ objectKey: assetTable.objectKey })
    .from(assetTable)
    .where(inArray(assetTable.projectId, ids));
  // Includes trash: those blobs also belong to the deleted container.
  const documents = await tx
    .select()
    .from(documentTable)
    .where(inArray(documentTable.projectId, ids));
  const deletions = await Promise.all(
    documents.map(async (document) => ({
      documentId: document.id,
      remove: await prepareDocumentBlobDeletion(document),
    })),
  );
  return { assets, deletions };
}

/** Run after commit so a failed database delete never destroys live files. */
export async function cleanupContainerStorage(
  captured: Awaited<ReturnType<typeof collectContainerStorage>>,
) {
  await deleteS3Keys(captured.assets.map((asset) => asset.objectKey));
  const results = await Promise.allSettled(
    captured.deletions.map((deletion) => deletion.remove()),
  );
  for (const [index, result] of results.entries()) {
    if (result.status === "rejected") {
      console.error("Failed to remove deleted container document", {
        documentId: captured.deletions[index]?.documentId,
        error: result.reason,
      });
    }
  }
}
