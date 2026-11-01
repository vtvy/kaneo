import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { projectTable } from "../../database/schema";
import { publishEvent } from "../../events";
import {
  assertProjectBackgroundKeyMatchesContext,
  deleteS3Object,
  validateProjectBackgroundUploadInput,
} from "../../storage/s3";
import { normalizeApiServerUrl } from "../../utils/openapi-spec";

async function finalizeProjectBackground(
  projectId: string,
  input: {
    key: string;
    contentType: string;
    size: number;
    version: string;
  },
  apiBaseUrl: string,
) {
  try {
    validateProjectBackgroundUploadInput(input.contentType, input.size);
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

  const normalizedKey = input.key.trim();
  if (
    !assertProjectBackgroundKeyMatchesContext(normalizedKey, {
      workspaceId: projectContext.workspaceId,
      projectId: projectContext.projectId,
      version: input.version,
    })
  ) {
    throw new HTTPException(400, {
      message: "Image upload key does not match the project context.",
    });
  }

  const [currentProject] = await db
    .select({ backgroundObjectKey: projectTable.backgroundObjectKey })
    .from(projectTable)
    .where(eq(projectTable.id, projectId))
    .limit(1);

  const [updatedProject] = await db
    .update(projectTable)
    .set({
      backgroundObjectKey: normalizedKey,
      backgroundMimeType: input.contentType,
      backgroundVersion: input.version,
    })
    .where(eq(projectTable.id, projectId))
    .returning({ id: projectTable.id });

  if (!updatedProject) {
    throw new HTTPException(500, { message: "Failed to save background" });
  }

  if (
    currentProject?.backgroundObjectKey &&
    currentProject.backgroundObjectKey !== normalizedKey
  ) {
    deleteS3Object(currentProject.backgroundObjectKey).catch((error) => {
      console.warn(`S3 cleanup error: ${error}`);
    });
  }

  await publishEvent("project.updated", { projectId });

  return {
    url: `${normalizeApiServerUrl(apiBaseUrl)}/project/${updatedProject.id}/background?v=${encodeURIComponent(input.version)}`,
  };
}

export default finalizeProjectBackground;
