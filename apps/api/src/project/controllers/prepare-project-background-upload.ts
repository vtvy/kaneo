import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { projectTable } from "../../database/schema";
import {
  createProjectBackgroundUploadUrl,
  validateProjectBackgroundUploadInput,
} from "../../storage/s3";

async function prepareProjectBackgroundUpload(
  projectId: string,
  contentType: string,
  size: number,
) {
  try {
    validateProjectBackgroundUploadInput(contentType, size);
  } catch (error) {
    throw new HTTPException(400, {
      message:
        error instanceof Error ? error.message : "Invalid image upload request",
    });
  }

  const [projectContext] = await db
    .select({
      projectId: projectTable.id,
      workspaceId: projectTable.workspaceId,
    })
    .from(projectTable)
    .where(eq(projectTable.id, projectId))
    .limit(1);

  if (!projectContext) {
    throw new HTTPException(404, { message: "Project not found" });
  }

  try {
    return await createProjectBackgroundUploadUrl({
      workspaceId: projectContext.workspaceId,
      projectId: projectContext.projectId,
      contentType,
      size,
    });
  } catch (error) {
    throw new HTTPException(503, {
      message:
        error instanceof Error
          ? error.message
          : "Image uploads are not configured",
    });
  }
}

export default prepareProjectBackgroundUpload;
