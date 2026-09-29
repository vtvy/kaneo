import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  assetTable,
  projectTable,
  taskTable,
  workspaceTable,
} from "../../database/schema";
import { storage } from "../../storage";
import {
  buildObjectKey,
  isImageContentType,
  validateTaskAssetUploadInput,
} from "../../storage/s3";

type UploadSurface = "description" | "comment";

// Upload-through-API for task assets: mirrors the document upload path. The
// filesystem driver has no presign, so the bytes flow through the API. We reuse
// the s3.ts key shape (buildObjectKey) and validation helpers so keys stay
// consistent with the legacy presigned flow, then record an asset row.
async function uploadTaskAsset({
  taskId,
  surface,
  file,
  currentUserId,
}: {
  taskId: string;
  surface: UploadSurface;
  file: File;
  currentUserId: string;
}) {
  if (!file || file.size <= 0) {
    throw new HTTPException(400, { message: "Empty file" });
  }

  const contentType = file.type || "application/octet-stream";

  try {
    validateTaskAssetUploadInput(contentType, file.size);
  } catch (error) {
    throw new HTTPException(400, {
      message:
        error instanceof Error ? error.message : "Invalid file upload request",
    });
  }

  const [taskContext] = await db
    .select({
      taskId: taskTable.id,
      projectId: taskTable.projectId,
      workspaceId: workspaceTable.id,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .innerJoin(workspaceTable, eq(projectTable.workspaceId, workspaceTable.id))
    .where(eq(taskTable.id, taskId))
    .limit(1);

  if (!taskContext) {
    throw new HTTPException(404, { message: "Task not found" });
  }

  // Same key shape as the presigned-S3 flow. No S3 keyPrefix is applied: local
  // storage has no bucket prefix and the fs driver resolves multi-segment keys.
  const key = buildObjectKey({
    workspaceId: taskContext.workspaceId,
    projectId: taskContext.projectId,
    taskId: taskContext.taskId,
    surface,
    filename: file.name,
    contentType,
  });

  const buf = Buffer.from(await file.arrayBuffer());
  await storage.put(key, buf, contentType);

  const [asset] = await db
    .insert(assetTable)
    .values({
      workspaceId: taskContext.workspaceId,
      projectId: taskContext.projectId,
      taskId: taskContext.taskId,
      objectKey: key,
      filename: file.name,
      mimeType: contentType,
      size: file.size,
      kind: isImageContentType(contentType) ? "image" : "attachment",
      surface,
      createdBy: currentUserId || null,
    })
    .returning({ id: assetTable.id });

  if (!asset) {
    await storage.delete(key).catch(() => {}); // roll back the blob
    throw new HTTPException(500, { message: "Failed to record asset" });
  }

  return asset;
}

export default uploadTaskAsset;
