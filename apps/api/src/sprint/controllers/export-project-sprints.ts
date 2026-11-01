import { asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  projectTable,
  sprintTable,
  taskSprintTable,
  taskTable,
  userTable,
} from "../../database/schema";
import { buildSprintExportSheets } from "../sprint-export-rows";
import { buildSprintWorkbook } from "../sprint-export-workbook";

const currentSprint = alias(sprintTable, "current_sprint");

async function exportProjectSprints(projectId: string) {
  const project = await db.query.projectTable.findFirst({
    where: eq(projectTable.id, projectId),
  });

  if (!project) {
    throw new HTTPException(404, { message: "Project not found" });
  }

  const memberships = await db
    .select({
      sprintId: sprintTable.id,
      sprintName: sprintTable.name,
      taskNumber: taskTable.number,
      title: taskTable.title,
      status: taskTable.status,
      priority: taskTable.priority,
      points: taskTable.points,
      assigneeName: userTable.name,
      addedAt: taskSprintTable.addedAt,
      removedAt: taskSprintTable.removedAt,
      currentSprintName: currentSprint.name,
    })
    .from(taskSprintTable)
    .innerJoin(taskTable, eq(taskSprintTable.taskId, taskTable.id))
    .innerJoin(sprintTable, eq(taskSprintTable.sprintId, sprintTable.id))
    .leftJoin(userTable, eq(taskTable.userId, userTable.id))
    .leftJoin(currentSprint, eq(taskTable.sprintId, currentSprint.id))
    .where(eq(sprintTable.projectId, projectId))
    .orderBy(asc(sprintTable.createdAt), asc(taskTable.position));

  const sheets = buildSprintExportSheets(
    memberships.map((membership) => ({
      sprintId: membership.sprintId,
      sprintName: membership.sprintName,
      taskKey:
        membership.taskNumber == null
          ? ""
          : `${project.slug}-${membership.taskNumber}`,
      title: membership.title,
      status: membership.status ?? "",
      priority: membership.priority,
      points: membership.points,
      assigneeName: membership.assigneeName,
      addedAt: membership.addedAt,
      removedAt: membership.removedAt,
      currentSprintName: membership.currentSprintName,
    })),
  );

  const workbook = buildSprintWorkbook(sheets);
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const safeSlug = project.slug.replace(/[^A-Za-z0-9._-]/g, "") || "project";

  return { filename: `${safeSlug}-sprints.xlsx`, buffer };
}

export default exportProjectSprints;
