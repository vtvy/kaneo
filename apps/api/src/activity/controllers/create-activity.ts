import db from "../../database";
import { activityTable } from "../../database/schema";

async function createActivity(
  taskId: string | null,
  type: string,
  userId: string,
  content: string | null,
  eventData?: Record<string, unknown> | null,
  sprintId?: string | null,
) {
  const [activity] = await db
    .insert(activityTable)
    .values({
      taskId,
      sprintId: sprintId ?? null,
      type,
      userId,
      content,
      eventData: eventData ?? null,
    })
    .returning();
  return activity;
}

export default createActivity;
