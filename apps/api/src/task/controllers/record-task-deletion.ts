import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import db from "../../database";
import {
  projectTable,
  taskDeletionTable,
  userTable,
} from "../../database/schema";

export type TaskDeletionSnapshot = {
  taskId: string;
  projectId: string;
  title: string;
  number?: number | null;
  reporterId?: string | null;
  assigneeId?: string | null;
};

async function recordTaskDeletion(
  snapshot: TaskDeletionSnapshot,
  deletedById: string,
) {
  const [[project], [actor]] = await Promise.all([
    db
      .select({ workspaceId: projectTable.workspaceId })
      .from(projectTable)
      .where(eq(projectTable.id, snapshot.projectId))
      .limit(1),
    db
      .select({ id: userTable.id, name: userTable.name })
      .from(userTable)
      .where(eq(userTable.id, deletedById))
      .limit(1),
  ]);

  if (!project?.workspaceId) {
    return null;
  }

  const [row] = await db
    .insert(taskDeletionTable)
    .values({
      id: createId(),
      taskId: snapshot.taskId,
      taskNumber: snapshot.number ?? null,
      taskTitle: snapshot.title,
      projectId: snapshot.projectId,
      workspaceId: project.workspaceId,
      deletedBy: deletedById,
    })
    .returning();

  return {
    workspaceId: project.workspaceId,
    deletedById,
    deletedByName: actor?.name ?? deletedById,
    taskId: snapshot.taskId,
    taskNumber: snapshot.number ?? null,
    taskTitle: snapshot.title,
    projectId: snapshot.projectId,
    reporterId: snapshot.reporterId ?? null,
    assigneeId: snapshot.assigneeId ?? null,
    deletionId: row?.id,
  };
}

export default recordTaskDeletion;
