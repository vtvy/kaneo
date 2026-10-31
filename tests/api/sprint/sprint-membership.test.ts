import { describe, expect, it } from "vitest";
import {
  planSprintMembershipChange,
  type SprintMembership,
} from "../../../apps/api/src/sprint/sprint-membership";

function membership(
  sprintId: string,
  removedAt: string | null,
  addedAt = "2026-01-01T00:00:00.000Z",
): SprintMembership {
  return {
    sprintId,
    addedAt: new Date(addedAt),
    removedAt: removedAt ? new Date(removedAt) : null,
  };
}

describe("planSprintMembershipChange", () => {
  it("opens a membership when a task enters its first sprint", () => {
    expect(planSprintMembershipChange([], "sprint-1")).toEqual({
      closeSprintIds: [],
      reopenSprintId: null,
      insertSprintId: "sprint-1",
    });
  });

  it("closes the current sprint and opens the next one", () => {
    expect(
      planSprintMembershipChange([membership("sprint-1", null)], "sprint-2"),
    ).toEqual({
      closeSprintIds: ["sprint-1"],
      reopenSprintId: null,
      insertSprintId: "sprint-2",
    });
  });

  it("reopens a sprint the task already passed through", () => {
    expect(
      planSprintMembershipChange(
        [
          membership("sprint-1", "2026-02-01T00:00:00.000Z"),
          membership("sprint-2", null, "2026-02-01T00:00:00.000Z"),
        ],
        "sprint-1",
      ),
    ).toEqual({
      closeSprintIds: ["sprint-2"],
      reopenSprintId: "sprint-1",
      insertSprintId: null,
    });
  });

  it("closes the current sprint when the task returns to the backlog", () => {
    expect(
      planSprintMembershipChange([membership("sprint-2", null)], null),
    ).toEqual({
      closeSprintIds: ["sprint-2"],
      reopenSprintId: null,
      insertSprintId: null,
    });
  });

  it("does nothing when the task is already in that sprint", () => {
    expect(
      planSprintMembershipChange([membership("sprint-2", null)], "sprint-2"),
    ).toEqual({
      closeSprintIds: [],
      reopenSprintId: null,
      insertSprintId: null,
    });
  });

  it("does nothing for a backlog task staying in the backlog", () => {
    expect(
      planSprintMembershipChange(
        [membership("sprint-1", "2026-02-01T00:00:00.000Z")],
        null,
      ),
    ).toEqual({
      closeSprintIds: [],
      reopenSprintId: null,
      insertSprintId: null,
    });
  });
});
