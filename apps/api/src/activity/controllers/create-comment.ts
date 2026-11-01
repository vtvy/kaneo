import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { resolveMentionRecipients } from "../../comment/mentions";
import db from "../../database";
import {
  activityTable,
  projectTable,
  taskTable,
  userTable,
} from "../../database/schema";
import { publishEvent } from "../../events";

async function createComment(taskId: string, userId: string, content: string) {
  const [activity] = await db
    .insert(activityTable)
    .values({
      taskId,
      type: "comment",
      userId,
      content,
    })
    .returning();

  if (!activity) {
    throw new HTTPException(500, {
      message: "Failed to create activity",
    });
  }

  const [user] = await db
    .select({ name: userTable.name })
    .from(userTable)
    .where(eq(userTable.id, userId));

  const [task] = await db
    .select({
      projectId: taskTable.projectId,
      title: taskTable.title,
      workspaceId: projectTable.workspaceId,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(eq(taskTable.id, taskId));

  if (task) {
    // @mentions are parsed from the stored comment body on the server; only
    // workspace members who can read the project are notified, never the
    // author.
    const mentions = await resolveMentionRecipients({
      content,
      authorId: userId,
      workspaceId: task.workspaceId,
      projectId: task.projectId,
    });

    await publishEvent("task.comment_created", {
      ...activity,
      comment: `"${user?.name}" commented: ${content}`,
      projectId: task.projectId,
      mentions,
      taskTitle: task.title,
      actorName: user?.name ?? "",
    });
  }

  return activity;
}

export default createComment;
