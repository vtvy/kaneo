import { describe, expect, it } from "vitest";
import { toAssignedTasks } from "./endpoints.js";

describe("toAssignedTasks", () => {
  it("maps the fork my-tasks rows onto the assigned task list", () => {
    expect(
      toAssignedTasks([
        {
          id: "t1",
          projectId: "p1",
          number: 12,
          title: "Fix login",
          status: "in-progress",
          columnName: "In Progress",
          priority: "high",
          dueDate: "2026-11-01T00:00:00.000Z",
          projectName: "Kaneo",
          projectSlug: "kan",
        },
        {
          id: "t2",
          projectId: "p1",
          number: null,
          title: "Notes",
          status: "to-do",
          columnName: null,
          priority: "low",
          dueDate: null,
          projectName: "Kaneo",
          projectSlug: "kan",
        },
      ]),
    ).toEqual({
      total: 2,
      tasks: [
        {
          id: "t1",
          projectId: "p1",
          number: 12,
          title: "Fix login",
          status: "in-progress",
          statusName: "In Progress",
          priority: "high",
          dueDate: "2026-11-01T00:00:00.000Z",
          projectName: "Kaneo",
          projectSlug: "kan",
        },
        {
          id: "t2",
          projectId: "p1",
          number: null,
          title: "Notes",
          status: "to-do",
          statusName: null,
          priority: "low",
          dueDate: null,
          projectName: "Kaneo",
          projectSlug: "kan",
        },
      ],
    });
  });
});
