export type SubtaskProgress = {
  completed: number;
  total: number;
  childIds: string[];
};

export function summarizeSubtasks(
  rows: readonly {
    parentId: string;
    childId: string;
    completed: boolean;
  }[],
): Map<string, SubtaskProgress> {
  const progress = new Map<string, SubtaskProgress>();

  for (const row of rows) {
    if (row.parentId === row.childId) continue;

    let entry = progress.get(row.parentId);
    if (!entry) {
      entry = { completed: 0, total: 0, childIds: [] };
      progress.set(row.parentId, entry);
    }
    if (entry.childIds.includes(row.childId)) continue;

    entry.childIds.push(row.childId);
    entry.total += 1;
    if (row.completed) entry.completed += 1;
  }

  return progress;
}
