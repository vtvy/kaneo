import { formatDateMedium } from "@/lib/format";
import { getPriorityLabel, getStatusDisplayLabel } from "@/lib/i18n/domain";

type Translate = (key: string, options?: Record<string, unknown>) => string;

export type DescribableActivity = {
  type: string;
  eventData: unknown;
  excerpt: string | null;
};

function eventDataOf(activity: DescribableActivity) {
  const { eventData } = activity;
  if (!eventData || typeof eventData !== "object" || Array.isArray(eventData)) {
    return null;
  }
  return eventData as Record<string, unknown>;
}

function formatEventDate(value: unknown) {
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : formatDateMedium(date);
}

function optionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

// What the actor did, phrased to follow their name: "Mira <changed status…>".
export function describeActivity(
  activity: DescribableActivity,
  t: Translate,
): string {
  const eventData = eventDataOf(activity);

  switch (activity.type) {
    case "comment":
      return t("workspace:home.activity.commented");
    case "create":
    case "created":
    case "task":
      return t("activity:created");
    case "unassigned":
      return t("activity:unassigned");
    case "status_changed":
      if (eventData) {
        return t("activity:changedStatus", {
          from: getStatusDisplayLabel(
            String(eventData.oldStatus ?? ""),
            optionalString(eventData.oldStatusName),
          ),
          to: getStatusDisplayLabel(
            String(eventData.newStatus ?? ""),
            optionalString(eventData.newStatusName),
          ),
        });
      }
      break;
    case "priority_changed":
      if (eventData) {
        return t("activity:changedPriority", {
          from: getPriorityLabel(String(eventData.oldPriority ?? "")),
          to: getPriorityLabel(String(eventData.newPriority ?? "")),
        });
      }
      break;
    case "assignee_changed":
      if (eventData) {
        return eventData.isSelfAssigned
          ? t("activity:assignedToSelf")
          : t("activity:assignedTo", {
              name: String(eventData.newAssignee ?? ""),
            });
      }
      break;
    case "due_date_changed":
      if (eventData) {
        if (!eventData.newDueDate) return t("activity:clearedDueDate");
        return eventData.oldDueDate
          ? t("activity:changedDueDate", {
              from: formatEventDate(eventData.oldDueDate),
              to: formatEventDate(eventData.newDueDate),
            })
          : t("activity:setDueDate", {
              date: formatEventDate(eventData.newDueDate),
            });
      }
      break;
    case "title_changed":
      if (eventData) {
        return t("activity:changedTitle", {
          from: String(eventData.oldTitle ?? ""),
          to: String(eventData.newTitle ?? ""),
        });
      }
      break;
    case "moved":
      if (eventData?.toProjectName) {
        return t("activity:moved", {
          from: String(eventData.fromProjectName ?? ""),
          to: String(eventData.toProjectName),
        });
      }
      break;
    default:
      break;
  }

  // Events recorded before eventData existed only have their English text.
  return activity.excerpt || t("workspace:home.activity.updated");
}
