export type SubtaskRow<T> = {
  task: T;
  depth: number;
  rowId: string;
  childCount: number;
};

export function flattenSubtaskRows<
  T extends { id: string; subtaskIds?: string[] },
>({
  tasks,
  tasksById,
  isExpanded,
}: {
  tasks: readonly T[];
  tasksById: Map<string, T>;
  isExpanded: (rowId: string) => boolean;
}): SubtaskRow<T>[] {
  const rows: SubtaskRow<T>[] = [];

  const walk = (
    task: T,
    depth: number,
    ancestors: Set<string>,
    path: string,
  ) => {
    const rowId = path ? `${path}/${task.id}` : task.id;
    const childTasks: T[] = [];
    for (const childId of task.subtaskIds ?? []) {
      const child = tasksById.get(childId);
      if (child && child.id !== task.id && !ancestors.has(child.id)) {
        childTasks.push(child);
      }
    }

    rows.push({
      task,
      depth,
      rowId,
      childCount: childTasks.length,
    });

    if (childTasks.length === 0 || !isExpanded(rowId)) return;

    const nextAncestors = new Set(ancestors);
    nextAncestors.add(task.id);
    for (const child of childTasks) {
      walk(child, depth + 1, nextAncestors, rowId);
    }
  };

  for (const task of tasks) {
    walk(task, 0, new Set(), "");
  }

  return rows;
}
