import de from "../../../../i18n/de-DE.json";
import en from "../../../../i18n/en-US.json";
import ko from "../../../../i18n/ko-KR.json";

/** Active notification email locales (match shipped app languages). */
const resources = { en, de, ko };
type Locale = keyof typeof resources;
type NotificationContent = { title: string; body: string };
type Notification = {
  type: string;
  title: string | null;
  content: string | null;
  eventData: Record<string, unknown> | null;
};

/** Localize structured system events for email only; leave authored content intact. */
export function localizeNotificationEmail(
  notification: Notification,
  locale: string | null | undefined,
  fallback: NotificationContent,
): NotificationContent {
  if (notification.title !== null || notification.content !== null) {
    return {
      title: notification.title ?? fallback.title,
      body: notification.content ?? fallback.body,
    };
  }

  const language = locale?.trim().toLowerCase().split(/[-_]/)[0] ?? "en";
  const resource =
    resources[Object.hasOwn(resources, language) ? (language as Locale) : "en"];
  const events = resource.notifications.events;
  if (!notification.eventData || !Object.hasOwn(events, notification.type)) {
    return fallback;
  }

  const copy = events[notification.type as keyof typeof events];
  const values: Record<string, string> = {};
  for (const [, key] of copy.content.matchAll(/\{\{(\w+)\}\}/g)) {
    if (!key) continue;
    const value = notification.eventData[key];
    if (typeof value !== "string") return fallback;
    const statuses = resource.tasks.status;
    values[key] =
      (key === "oldStatus" || key === "newStatus") &&
      value !== "label" &&
      Object.hasOwn(statuses, value)
        ? statuses[value as keyof typeof statuses]
        : value;
  }

  return {
    title: copy.title,
    body: copy.content.replace(
      /\{\{(\w+)\}\}/g,
      (match, key: string) => values[key] ?? match,
    ),
  };
}
