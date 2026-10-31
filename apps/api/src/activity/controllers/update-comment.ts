import { and, eq } from "drizzle-orm";
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
import { deleteOrphanedAssets } from "../../storage/cleanup-assets";
import { parseMentionIds } from "../../utils/parse-mentions";

async function updateComment(userId: string, id: string, content: string) {
  const [existing] = await db
    .select({
      id: activityTable.id,
      content: activityTable.content,
      taskId: activityTable.taskId,
    })
    .from(activityTable)
    .where(and(eq(activityTable.id, id), eq(activityTable.userId, userId)))
    .limit(1);

  if (!existing) {
    throw new HTTPException(404, {
      message: "Comment not found or you are not the author",
    });
  }

  const [updated] = await db
    .update(activityTable)
    .set({ content })
    .where(and(eq(activityTable.id, id), eq(activityTable.userId, userId)))
    .returning();

  if (!updated) {
    throw new HTTPException(404, {
      message: "Comment not found or you are not the author",
    });
  }

  const [task] = await db
    .select({
      projectId: taskTable.projectId,
      title: taskTable.title,
      workspaceId: projectTable.workspaceId,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(eq(taskTable.id, updated.taskId))
    .limit(1);

  if (task) {
    // Only users newly @mentioned by this edit are notified; people already
    // mentioned in the previous version were notified when it was posted.
    const mentions = await resolveMentionRecipients({
      content,
      authorId: userId,
      workspaceId: task.workspaceId,
      projectId: task.projectId,
      excludeIds: parseMentionIds(existing.content),
    });

    let actorName = "";
    if (mentions.length > 0) {
      const [user] = await db
        .select({ name: userTable.name })
        .from(userTable)
        .where(eq(userTable.id, userId));
      actorName = user?.name ?? "";
    }

    await publishEvent("comment.updated", {
      ...updated,
      projectId: task.projectId,
      userId,
      mentions,
      taskTitle: task.title,
      actorName,
    });
  }

  deleteOrphanedAssets(existing.content, content, {
    taskId: existing.taskId,
  }).catch(() => {});

  return updated;
}

export default updateComment;
