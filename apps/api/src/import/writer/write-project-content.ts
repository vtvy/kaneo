import type { ImportedProject, ImportSourceId } from "@kaneo/importers";
import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { projectTable } from "../../database/schema";
import type { ImportCounts } from "../import-run-project";
import { assignImportTaskNumbers } from "./assign-import-task-numbers";
import type { Transaction } from "./create-import-project";
import { loadAssignableMembers } from "./load-assignable-members";
import { createAssigneeMatcher } from "./match-assignees";
import { planImportColumns } from "./plan-import-columns";
import { planImportRelations } from "./plan-import-relations";
import { capText, planImportTasks } from "./plan-import-tasks";
import { writeImportColumns } from "./write-import-columns";
import { writeImportComments } from "./write-import-comments";
import { writeImportLabels } from "./write-import-labels";
import { writeImportRelations } from "./write-import-relations";
import { writeImportTasks } from "./write-import-tasks";

export const MAX_IMPORT_TASKS = 20_000;

export type ProjectContentInput = {
  projectId: string;
  workspaceId: string;
  userId: string;
  source: ImportSourceId;
  project: ImportedProject;
  includeComments: boolean;
};

export async function writeProjectContent(
  tx: Transaction,
  {
    projectId,
    workspaceId,
    userId,
    source,
    project,
    includeComments,
  }: ProjectContentInput,
): Promise<{ counts: ImportCounts; warnings: string[] }> {
  if (project.tasks.length > MAX_IMPORT_TASKS) {
    throw new HTTPException(400, {
      message: `This project has more than ${MAX_IMPORT_TASKS.toLocaleString("en-US")} tasks, more than Kaneo imports at once.`,
    });
  }

  const now = new Date();
  const description = project.description?.trim();
  if (description) {
    await tx
      .update(projectTable)
      .set({ description: capText(description) })
      .where(eq(projectTable.id, projectId));
  }

  const columnPlan = planImportColumns(project.columns);
  const board = await writeImportColumns(tx, projectId, columnPlan);
  const assignees = createAssigneeMatcher(
    await loadAssignableMembers(tx, workspaceId),
  );

  const { numbers } = assignImportTaskNumbers(project.tasks);
  const tasks = planImportTasks({
    tasks: project.tasks,
    columns: board.byKey,
    fallbackColumn: board.fallback,
    numbers,
    now,
    newId: createId,
    assign: assignees.match,
  });
  await writeImportTasks(tx, projectId, userId, tasks);

  const labels = await writeImportLabels(
    tx,
    workspaceId,
    project.labels,
    tasks,
  );

  const comments = includeComments
    ? await writeImportComments(tx, {
        tasks,
        importedBy: userId,
        source,
        now,
      })
    : 0;

  const relations = await writeImportRelations(
    tx,
    planImportRelations(
      project.relations,
      new Map(tasks.map((task) => [task.key, task.id])),
    ),
  );

  const unmatched = assignees.warning();
  return {
    counts: {
      columns: board.count,
      tasks: tasks.length,
      labels,
      comments,
      assignees: tasks.filter((task) => task.userId).length,
      relations,
    },
    warnings: [
      ...project.warnings,
      ...columnPlan.warnings,
      ...(unmatched ? [unmatched] : []),
    ],
  };
}
