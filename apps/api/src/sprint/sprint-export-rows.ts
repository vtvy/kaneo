export type SprintExportTask = {
  sprintId?: string;
  sprintName: string;
  taskKey: string;
  title: string;
  status: string;
  priority: string | null;
  points: number | null;
  assigneeName: string | null;
  addedAt: Date;
  removedAt: Date | null;
  currentSprintName: string | null;
};

export type SprintExportCell = string | number | Date | null;

export type SprintExportRow = {
  cells: SprintExportCell[];
  // True while the task is still in this sprint; moved-on rows are dimmed.
  current: boolean;
};

export type SprintExportSheet = {
  name: string;
  rows: SprintExportRow[];
};

export const SPRINT_EXPORT_COLUMNS = [
  { header: "Key", width: 14 },
  { header: "Title", width: 42 },
  { header: "Status", width: 16 },
  { header: "Priority", width: 14 },
  { header: "Points", width: 10 },
  { header: "Assignee", width: 22 },
  { header: "Joined sprint", width: 14 },
  { header: "Left sprint", width: 14 },
  { header: "Situation", width: 28 },
] as const;

export const SPRINT_EXPORT_POINTS_COLUMN = 4;
export const SPRINT_EXPORT_DATE_COLUMNS = [6, 7];

const SHEET_NAME_MAX = 31;

export function describeSprintMembership({
  removedAt,
  currentSprintName,
}: {
  removedAt: Date | null;
  currentSprintName: string | null;
}) {
  if (removedAt == null) return "In this sprint";
  if (currentSprintName) return `Moved to ${currentSprintName}`;
  return "Back to backlog";
}

// Excel sheet names: max 31 chars, no : \ / ? * [ ], unique per workbook.
export function toSheetName(name: string, used: Set<string>) {
  const cleaned = name.replace(/[:\\/?*[\]]/g, " ").trim() || "Sprint";
  const base = cleaned.slice(0, SHEET_NAME_MAX);
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate.toLowerCase())) {
    const tail = ` ${suffix}`;
    candidate = `${base.slice(0, SHEET_NAME_MAX - tail.length)}${tail}`;
    suffix += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

export function buildSprintExportSheets(
  tasks: SprintExportTask[],
): SprintExportSheet[] {
  const groups = new Map<string, SprintExportTask[]>();

  for (const task of tasks) {
    const key = task.sprintId ?? task.sprintName;
    const group = groups.get(key);
    if (group) {
      group.push(task);
    } else {
      groups.set(key, [task]);
    }
  }

  const usedNames = new Set<string>();
  return [...groups.values()].map((group) => {
    const sorted = [...group].sort((left, right) => {
      const leftOpen = left.removedAt == null ? 0 : 1;
      const rightOpen = right.removedAt == null ? 0 : 1;
      if (leftOpen !== rightOpen) return leftOpen - rightOpen;
      return left.addedAt.getTime() - right.addedAt.getTime();
    });

    return {
      name: toSheetName(group[0]?.sprintName ?? "Sprint", usedNames),
      rows: sorted.map((task) => ({
        current: task.removedAt == null,
        cells: [
          task.taskKey,
          task.title,
          task.status,
          task.priority ?? "",
          task.points,
          task.assigneeName ?? "",
          task.addedAt,
          task.removedAt,
          describeSprintMembership(task),
        ],
      })),
    };
  });
}
