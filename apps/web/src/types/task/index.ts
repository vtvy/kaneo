type TaskLabel = {
  id: string;
  name: string;
  color: string;
};

type TaskExternalLink = {
  id: string;
  taskId: string;
  integrationId: string | null;
  resourceType: string;
  externalId: string;
  url: string;
  title: string | null;
  metadata: Record<string, unknown> | null;
};

export type TaskRecurrence = {
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  interval: number;
  weekdays?: number[];
  timeZone: string;
};

type Task = {
  id: string;
  type?: string;
  parentId?: string | null;
  title: string;
  number: number | null;
  description: string | null;
  // Nullable to match the API schema (`task.status` has no NOT NULL).
  status: string | null;
  priority: string | null;
  points?: number | null;
  startDate: string | null;
  dueDate: string | null;
  recurrence?: TaskRecurrence | null;
  position: number | null;
  createdAt: string;
  updatedAt?: string;
  userId: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeImage?: string | null;
  reporterId?: string | null;
  reporterName?: string | null;
  reporterImage?: string | null;
  projectId: string;
  columnId?: string | null;
  sprintId?: string | null;
  labels?: TaskLabel[];
  subtaskCounts?: { completed: number; total: number };
  subtaskIds?: string[];
  externalLinks?: TaskExternalLink[];
  involvedUserIds?: string[];
};

export default Task;
