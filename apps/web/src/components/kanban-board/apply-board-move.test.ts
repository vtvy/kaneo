import { describe, expect, it } from "vitest";
import type { ProjectWithTasks } from "@/types/project";
import { applyBoardMove } from "./apply-board-move";

function board(): ProjectWithTasks {
  return {
    id: "project",
    columns: [
      {
        id: "todo",
        tasks: [
          { id: "a", status: "todo", position: 0, projectId: "project" },
          { id: "b", status: "todo", position: 1, projectId: "project" },
        ],
      },
      {
        id: "done",
        tasks: [{ id: "c", status: "done", position: 0, projectId: "project" }],
      },
    ],
  } as ProjectWithTasks;
}

describe("applyBoardMove", () => {
  it("moves a card into another column and renumbers only the touched columns", () => {
    const moved = applyBoardMove(board(), "a", "done");
    expect(moved?.project.columns[0]?.tasks.map((task) => task.id)).toEqual([
      "b",
    ]);
    expect(moved?.project.columns[1]?.tasks.map((task) => task.id)).toEqual([
      "c",
      "a",
    ]);
    expect(moved?.changed.map((task) => task.id).sort()).toEqual(["a", "b"]);
    expect(moved?.changed.find((task) => task.id === "a")?.status).toBe("done");
  });

  it("leaves the board alone when the card is dropped on itself", () => {
    expect(applyBoardMove(board(), "a", "a")).toBeNull();
  });
});
