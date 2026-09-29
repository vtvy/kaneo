type TaskLabel = {
  id: string;
  name: string;
  color: string;
};

type TaskExternalLink = {
  id: string;
  taskId: string;
  integrationId: string;
  resourceType: string;
  externalId: string;
  url: string;
  title: string | null;
  metadata: Record<string, unknown> | null;
};

type Task = {
  id: string;
  title: string;
  number: number | null;
  description: string | null;
  // Nullable to match the API schema (`task.status` has no NOT NULL).
  status: string | null;
  priority: string | null;
  points?: number | null;
  startDate: string | null;
  dueDate: string | null;
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
  externalLinks?: TaskExternalLink[];
  involvedUserIds?: string[];
};

export default Task;
