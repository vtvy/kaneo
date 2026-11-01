import { describe, expect, it } from "vitest";
import { describeActivity } from "./describe-activity";

const t = (key: string, options?: Record<string, unknown>) =>
  options ? `${key} ${JSON.stringify(options)}` : key;

function activity(
  type: string,
  eventData: unknown = null,
  excerpt: string | null = null,
) {
  return { type, eventData, excerpt };
}

describe("describeActivity", () => {
  it("describes comments and creation without event data", () => {
    expect(describeActivity(activity("comment"), t)).toBe(
      "workspace:home.activity.commented",
    );
    expect(describeActivity(activity("created"), t)).toBe("activity:created");
  });

  it("uses event data for field changes", () => {
    expect(
      describeActivity(
        activity("priority_changed", {
          oldPriority: "low",
          newPriority: "high",
        }),
        t,
      ),
    ).toMatch(/^activity:changedPriority /);
    expect(
      describeActivity(
        activity("assignee_changed", { isSelfAssigned: true }),
        t,
      ),
    ).toBe("activity:assignedToSelf");
    expect(
      describeActivity(activity("due_date_changed", { newDueDate: null }), t),
    ).toBe("activity:clearedDueDate");
    expect(
      describeActivity(
        activity("title_changed", { oldTitle: "A", newTitle: "B" }),
        t,
      ),
    ).toBe('activity:changedTitle {"from":"A","to":"B"}');
  });

  it("falls back to the stored text, then a generic phrase", () => {
    expect(
      describeActivity(activity("status_changed", null, "moved it along"), t),
    ).toBe("moved it along");
    expect(describeActivity(activity("mystery", ["x"]), t)).toBe(
      "workspace:home.activity.updated",
    );
  });
});
