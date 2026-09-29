import { and, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { dedupeMentions } from "../../comment/mentions";
import db from "../../database";
import {
  activityTable,
  projectTable,
  taskTable,
  userTable,
  workspaceUserTable,
} from "../../database/schema";
import { publishEvent } from "../../events";

// Cap on how many users a single comment can @mention, to avoid notification
// spam / abuse via a crafted mentions array.
const MAX_MENTIONS = 50;

async function createComment(
  taskId: string,
  userId: string,
  content: string,
  mentions?: string[],
) {
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
    // Only @mention users who are actual members of the task's workspace, never
    // the commenter, capped to MAX_MENTIONS — so a user can't make the server
    // notify arbitrary or unbounded recipients.
    const candidateIds = dedupeMentions(mentions, userId).slice(
      0,
      MAX_MENTIONS,
    );
    let validMentions: string[] = [];
    if (candidateIds.length > 0) {
      const members = await db
        .select({ userId: workspaceUserTable.userId })
        .from(workspaceUserTable)
        .where(
          and(
            eq(workspaceUserTable.workspaceId, task.workspaceId),
            inArray(workspaceUserTable.userId, candidateIds),
          ),
        );
      const memberSet = new Set(members.map((m) => m.userId));
      validMentions = candidateIds.filter((id) => memberSet.has(id));
    }

    await publishEvent("task.comment_created", {
      ...activity,
      comment: `"${user?.name}" commented: ${content}`,
      projectId: task.projectId,
      mentions: validMentions,
      taskTitle: task.title,
      actorName: user?.name ?? "",
    });
  }

  return activity;
}

export default createComment;
