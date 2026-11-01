import { produce } from "immer";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";

export function applyBoardMove(
  project: ProjectWithTasks,
  activeId: string,
  overId: string,
): { project: ProjectWithTasks; changed: Task[] } | null {
  if (!project.columns || activeId === overId) return null;

  const next = produce(project, (draft) => {
    const sourceColumn = draft.columns?.find((column) =>
      column.tasks.some((task) => task.id === activeId),
    );
    const destinationColumn = draft.columns?.find(
      (column) =>
        column.id === overId || column.tasks.some((task) => task.id === overId),
    );
    if (!sourceColumn || !destinationColumn) return;

    const sourceTaskIndex = sourceColumn.tasks.findIndex(
      (task) => task.id === activeId,
    );
    const task = sourceColumn.tasks[sourceTaskIndex];
    if (!task) return;

    sourceColumn.tasks = sourceColumn.tasks.filter(
      (item) => item.id !== activeId,
    );

    if (sourceColumn.id === destinationColumn.id) {
      let destinationIndex = destinationColumn.tasks.findIndex(
        (item) => item.id === overId,
      );
      if (sourceTaskIndex <= destinationIndex) destinationIndex += 1;
      destinationColumn.tasks.splice(destinationIndex, 0, task);
    } else {
      task.status = destinationColumn.id;
      const destinationIndex =
        overId === destinationColumn.id
          ? destinationColumn.tasks.length
          : destinationColumn.tasks.findIndex((item) => item.id === overId) + 1;
      destinationColumn.tasks.splice(
        destinationIndex < 0
          ? destinationColumn.tasks.length
          : destinationIndex,
        0,
        task,
      );
    }

    const touched =
      sourceColumn.id === destinationColumn.id
        ? [sourceColumn]
        : [sourceColumn, destinationColumn];
    for (const column of touched) {
      column.tasks.forEach((item, index) => {
        item.position = index;
      });
    }
  });

  const previous = new Map(
    project.columns.flatMap((column) =>
      column.tasks.map(
        (task) =>
          [
            task.id,
            {
              status: task.status,
              position: task.position,
              columnId: column.id,
            },
          ] as const,
      ),
    ),
  );
  const changed = next.columns.flatMap((column) =>
    column.tasks.filter((task) => {
      const before = previous.get(task.id);
      return (
        !before ||
        before.position !== task.position ||
        before.status !== task.status ||
        before.columnId !== column.id
      );
    }),
  );
  if (changed.length === 0) return null;
  return { project: next, changed };
}
