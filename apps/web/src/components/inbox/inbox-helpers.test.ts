import { describe, expect, it } from "vitest";
import {
  filterNotifications,
  getNotificationLink,
  groupNotifications,
} from "./inbox-helpers";

function notification(
  overrides: Partial<{
    id: string;
    type: string;
    isRead: boolean;
    createdAt: string;
    resourceId: string | null;
    resourceType: string | null;
    eventData: unknown;
  }> = {},
) {
  return {
    id: "n1",
    type: "task_created",
    isRead: false,
    createdAt: new Date(2026, 9, 14, 10).toISOString(),
    resourceId: null,
    resourceType: null,
    eventData: null,
    ...overrides,
  };
}

describe("filterNotifications", () => {
  const items = [
    notification({ id: "unread" }),
    notification({ id: "read", isRead: true }),
    notification({ id: "mention", type: "mention", isRead: true }),
  ];

  it("keeps everything for all", () => {
    expect(filterNotifications(items, "all")).toHaveLength(3);
  });

  it("keeps only unread or mentions", () => {
    expect(filterNotifications(items, "unread").map((n) => n.id)).toEqual([
      "unread",
    ]);
    expect(filterNotifications(items, "mentions").map((n) => n.id)).toEqual([
      "mention",
    ]);
  });
});

describe("groupNotifications", () => {
  it("splits today's notifications from earlier ones", () => {
    const now = new Date(2026, 9, 14, 18);
    const { today, earlier } = groupNotifications(
      [
        notification({
          id: "a",
          createdAt: new Date(2026, 9, 14, 1).toISOString(),
        }),
        notification({
          id: "b",
          createdAt: new Date(2026, 9, 13, 23).toISOString(),
        }),
      ],
      now,
    );
    expect(today.map((n) => n.id)).toEqual(["a"]);
    expect(earlier.map((n) => n.id)).toEqual(["b"]);
  });
});

describe("getNotificationLink", () => {
  it("opens the task when its location is known", () => {
    expect(
      getNotificationLink(
        notification({
          resourceType: "task",
          resourceId: "t1",
          eventData: { workspaceId: "w1", projectId: "p1" },
        }),
      ),
    ).toEqual({
      to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
      params: { workspaceId: "w1", projectId: "p1", taskId: "t1" },
    });
  });

  it("opens the project for deleted tasks", () => {
    expect(
      getNotificationLink(
        notification({
          resourceType: "project",
          resourceId: "p1",
          eventData: { workspaceId: "w1" },
        }),
      ),
    ).toEqual({
      to: "/dashboard/workspace/$workspaceId/project/$projectId",
      params: { workspaceId: "w1", projectId: "p1" },
    });
  });

  it("opens invitations for workspace notifications", () => {
    expect(
      getNotificationLink(notification({ resourceType: "workspace" })),
    ).toEqual({ to: "/dashboard/invitations" });
  });

  it("returns null without enough location data", () => {
    expect(
      getNotificationLink(
        notification({ resourceType: "task", resourceId: "t1" }),
      ),
    ).toBeNull();
    expect(getNotificationLink(notification())).toBeNull();
  });
});
