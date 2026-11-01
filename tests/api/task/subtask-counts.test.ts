import { describe, expect, it } from "vitest";
import { summarizeSubtasks } from "../../../apps/api/src/task/subtask-counts";

describe("summarizeSubtasks", () => {
  it("counts each child once and treats a final column as completed", () => {
    const progress = summarizeSubtasks([
      { parentId: "parent", childId: "done", completed: true },
      { parentId: "parent", childId: "open", completed: false },
      { parentId: "parent", childId: "done", completed: true },
      { parentId: "parent", childId: "parent", completed: false },
    ]);

    expect(progress.get("parent")).toEqual({
      completed: 1,
      total: 2,
      childIds: ["done", "open"],
    });
  });
});
