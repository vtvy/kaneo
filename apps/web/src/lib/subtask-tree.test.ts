import { describe, expect, it } from "vitest";
import { flattenSubtaskRows } from "./subtask-tree";

describe("flattenSubtaskRows", () => {
  const tasks = [
    { id: "parent", subtaskIds: ["child"] },
    { id: "child", subtaskIds: ["parent"] },
    { id: "other" },
  ];
  const tasksById = new Map(tasks.map((task) => [task.id, task]));

  it("keeps a child in its own row and repeats it under an expanded parent", () => {
    const rows = flattenSubtaskRows({
      tasks,
      tasksById,
      isExpanded: (rowId) => rowId === "parent",
    });

    expect(rows.map((row) => [row.rowId, row.depth])).toEqual([
      ["parent", 0],
      ["parent/child", 1],
      ["child", 0],
      ["other", 0],
    ]);
  });

  it("does not walk a cycle", () => {
    const rows = flattenSubtaskRows({
      tasks,
      tasksById,
      isExpanded: () => true,
    });

    expect(rows.map((row) => row.rowId)).toEqual([
      "parent",
      "parent/child",
      "child",
      "child/parent",
      "other",
    ]);
  });
});
