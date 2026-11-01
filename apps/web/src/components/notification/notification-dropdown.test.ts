import { describe, expect, it } from "vitest";
import type { Notification } from "@/types/notification";
import {
  getNotificationContent,
  getNotificationTitle,
} from "./notification-dropdown";

const t = (key: string, options?: Record<string, unknown>) =>
  `${key}|${options?.sprintName}|${options?.projectName}`;

const sprintNotification = (type: string) =>
  ({
    type,
    title: "fallback title",
    content: "fallback content",
    eventData: { sprintName: "Sprint 4", projectName: "Kaneo" },
  }) as unknown as Notification;

describe("sprint notification text", () => {
  it.each([
    "sprint_started",
    "sprint_ended",
  ])("maps %s to its i18n keys", (type) => {
    const notification = sprintNotification(type);
    expect(getNotificationTitle(notification, t)).toBe(
      `notifications:events.${type}.title|Sprint 4|Kaneo`,
    );
    expect(getNotificationContent(notification, t)).toBe(
      `notifications:events.${type}.content|Sprint 4|Kaneo`,
    );
  });
});
