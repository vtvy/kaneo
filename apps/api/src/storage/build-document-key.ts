import { createId } from "@paralleldrive/cuid2";
import { getFileExtension, sanitizePathSegment } from "./s3";

// Document namespace key layout, consistent with the s3.ts task-asset helpers:
//   project/<projectId>/documents/<base>-<ts>-<cuid>.<ext>
export function buildDocumentKey(projectId: string, filename: string): string {
  const ext = getFileExtension(filename);
  const base = sanitizePathSegment(
    filename.replace(/\.[^/.]+$/, "") || "file",
  ).slice(0, 64);
  const name = ext
    ? `${base}-${Date.now()}-${createId()}.${ext}`
    : `${base}-${Date.now()}-${createId()}`;
  return ["project", sanitizePathSegment(projectId), "documents", name].join(
    "/",
  );
}
