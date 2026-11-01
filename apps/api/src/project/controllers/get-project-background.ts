import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { projectTable } from "../../database/schema";
import { getPrivateObject, isImageContentType } from "../../storage/s3";

async function getProjectBackgroundResponse(
  projectId: string,
  ifNoneMatch: string | undefined,
) {
  const [projectData] = await db
    .select({
      backgroundObjectKey: projectTable.backgroundObjectKey,
      backgroundMimeType: projectTable.backgroundMimeType,
      backgroundVersion: projectTable.backgroundVersion,
    })
    .from(projectTable)
    .where(eq(projectTable.id, projectId))
    .limit(1);

  if (!projectData?.backgroundObjectKey) {
    throw new HTTPException(404, { message: "Project background not found" });
  }

  try {
    const object = await getPrivateObject(projectData.backgroundObjectKey);
    const contentType = (
      object.contentType ||
      projectData.backgroundMimeType ||
      ""
    )
      .toLowerCase()
      .split(";")[0]
      ?.trim();

    if (!contentType || !isImageContentType(contentType)) {
      await (object.body as ReadableStream).cancel();
      throw new HTTPException(404, { message: "Project background not found" });
    }

    const etag = object.etag || `"${projectData.backgroundVersion}"`;
    const headers: Record<string, string> = {
      "Cache-Control": "private, max-age=300, must-revalidate",
      "Content-Type": contentType,
      ETag: etag,
      Vary: "Cookie, Authorization",
      "X-Content-Type-Options": "nosniff",
    };
    if (object.contentLength !== undefined) {
      headers["Content-Length"] = object.contentLength.toString();
    }
    if (object.lastModified) {
      headers["Last-Modified"] = object.lastModified.toUTCString();
    }

    if (ifNoneMatch === etag) {
      await (object.body as ReadableStream).cancel();
      return new Response(null, { status: 304, headers });
    }

    return new Response(object.body as BodyInit, { headers });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    console.error("Failed to stream project background:", error);
    throw new HTTPException(404, { message: "Project background not found" });
  }
}

export default getProjectBackgroundResponse;
