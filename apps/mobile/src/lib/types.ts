export type Workspace = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  role: string;
};

export type Project = {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  statistics?: {
    totalTasks?: number;
    completionPercentage?: number;
  };
};

export type BoardTask = {
  id: string;
  title: string;
  status: string | null;
  priority: string | null;
  number: number | null;
  assigneeName?: string | null;
};

export type BoardColumn = {
  id: string;
  slug: string;
  name: string;
  tasks: BoardTask[];
};

export type BoardResponse = {
  data: {
    id: string;
    name: string;
    columns: BoardColumn[];
  };
};

export type TaskDetail = {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  projectId: string;
  userId: string | null;
  assigneeName: string | null;
  reporterId: string | null;
  number: number | null;
};

export type Comment = {
  id: string;
  content: string;
  createdAt: string;
  userId?: string | null;
  user?: {
    name?: string;
  };
};

export type TaskLabel = {
  id: string;
  name: string;
  color: string;
};

export type TaskFieldValue = {
  id: string;
  fieldName: string;
  fieldType: string;
  value: string | null;
};

export type Sprint = {
  id: string;
  name: string;
  goal: string | null;
  state: string;
  startDate: string | null;
  endDate: string | null;
  totalTasks?: number;
  completedTasks?: number;
};

export type SprintTask = {
  id: string;
  title: string;
  status: string | null;
  number: number | null;
  assigneeName: string | null;
  priority: string | null;
};

export type Member = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export type FolderItem = {
  id: string;
  name: string;
  parentId: string | null;
};

export type DocumentItem = {
  id: string;
  name: string;
  source: string;
  externalUrl: string | null;
  size: number;
  contentType: string;
  createdByName: string | null;
  createdAt: string;
};

export type NotificationItem = {
  id: string;
  title: string | null;
  content: string | null;
  type: string;
  isRead: boolean | null;
  createdAt: string;
};

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
};
