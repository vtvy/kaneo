import * as v from "valibot";

// Max tasks kept per list in a stored completion snapshot. Totals always
// cover every task; the lists are truncated beyond this.
export const SNAPSHOT_TASK_LIST_LIMIT = 500;

export const snapshotTaskSchema = v.object({
  id: v.string(),
  number: v.nullable(v.number()),
  title: v.string(),
});

const snapshotCountsSchema = v.object({
  total: v.number(),
  done: v.number(),
  carriedOver: v.number(),
});

export const sprintCompletionSnapshotSchema = v.object({
  version: v.literal(1),
  completedAt: v.string(),
  completedBy: v.nullable(v.string()),
  targetSprintId: v.nullable(v.string()),
  tasks: snapshotCountsSchema,
  points: snapshotCountsSchema,
  doneTasks: v.array(snapshotTaskSchema),
  carriedOverTasks: v.array(snapshotTaskSchema),
});

export type SnapshotTask = v.InferOutput<typeof snapshotTaskSchema>;
export type SprintCompletionSnapshot = v.InferOutput<
  typeof sprintCompletionSnapshotSchema
>;

type SnapshotSourceTask = SnapshotTask & {
  points: number | null;
  isFinal: boolean | null;
};

// Builds the snapshot from the sprint's tasks as they are at completion time
// (before carry-over). A task is done when its column is final; tasks with no
// column or a non-final column are carried over.
export function buildCompletionSnapshot({
  tasks,
  completedAt,
  completedBy,
  targetSprintId,
}: {
  tasks: SnapshotSourceTask[];
  completedAt: Date;
  completedBy: string | null;
  targetSprintId: string | null;
}): SprintCompletionSnapshot {
  const done = tasks.filter((task) => task.isFinal === true);
  const carriedOver = tasks.filter((task) => task.isFinal !== true);
  const sumPoints = (list: SnapshotSourceTask[]) =>
    list.reduce((sum, task) => sum + (task.points ?? 0), 0);
  const toEntry = ({ id, number, title }: SnapshotSourceTask) => ({
    id,
    number,
    title,
  });

  return {
    version: 1,
    completedAt: completedAt.toISOString(),
    completedBy,
    targetSprintId,
    tasks: {
      total: tasks.length,
      done: done.length,
      carriedOver: carriedOver.length,
    },
    points: {
      total: sumPoints(tasks),
      done: sumPoints(done),
      carriedOver: sumPoints(carriedOver),
    },
    doneTasks: done.slice(0, SNAPSHOT_TASK_LIST_LIMIT).map(toEntry),
    carriedOverTasks: carriedOver
      .slice(0, SNAPSHOT_TASK_LIST_LIMIT)
      .map(toEntry),
  };
}
