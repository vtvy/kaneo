import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { externalLinkTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";

async function createExternalLink({
  taskId,
  url,
  title,
  userId,
}: {
  taskId: string;
  url: string;
  title?: string;
  userId: string;
}) {
  const task = await db.query.taskTable.findFirst({
    where: eq(taskTable.id, taskId),
    columns: { projectId: true, title: true, status: true },
  });
  if (!task) {
    throw new HTTPException(404, { message: "Task not found" });
  }

  const [link] = await db
    .insert(externalLinkTable)
    .values({
      taskId,
      integrationId: null,
      resourceType: "url",
      externalId: url,
      url,
      title: title?.trim() ? title.trim() : null,
    })
    .returning();

  if (!link) {
    throw new HTTPException(500, { message: "Failed to create external link" });
  }

  await publishEvent("task.updated", {
    taskId,
    projectId: task.projectId,
    title: task.title,
    status: task.status,
    userId,
  });

  return link;
}

export default createExternalLink;
