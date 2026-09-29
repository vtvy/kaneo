import * as v from "valibot";

// A date input that must be parseable (clients send ISO 8601). Rejecting a
// garbage string here returns a clean 400 instead of letting `new Date("x")`
// become an Invalid Date that reaches the DB and surfaces as an unhandled 500.
export const dateStringSchema = v.pipe(
  v.string(),
  v.check(
    (value) => !Number.isNaN(new Date(value).getTime()),
    "Invalid date: expected an ISO date string",
  ),
);

export const labelSchema = v.object({
  id: v.string(),
  name: v.string(),
  color: v.string(),
  createdAt: v.date(),
  taskId: v.nullable(v.string()),
  workspaceId: v.nullable(v.string()),
});

export const sprintSchema = v.object({
  id: v.string(),
  projectId: v.string(),
  name: v.string(),
  goal: v.nullable(v.string()),
  startDate: v.nullable(v.date()),
  endDate: v.nullable(v.date()),
  state: v.picklist(["future", "active", "completed"] as const),
  completedAt: v.nullable(v.date()),
  createdAt: v.date(),
  updatedAt: v.date(),
  totalTasks: v.optional(v.number()),
  completedTasks: v.optional(v.number()),
  totalPoints: v.optional(v.number()),
  completedPoints: v.optional(v.number()),
});

export const projectSchema = v.object({
  id: v.string(),
  workspaceId: v.string(),
  slug: v.string(),
  icon: v.nullable(v.string()),
  name: v.string(),
  description: v.nullable(v.string()),
  createdAt: v.date(),
  isPublic: v.nullable(v.boolean()),
  archivedAt: v.nullable(v.date()),
  sprintCycleWeeks: v.optional(v.number()),
});

export const taskSchema = v.object({
  id: v.string(),
  projectId: v.string(),
  position: v.nullable(v.number()),
  number: v.nullable(v.number()),
  userId: v.nullable(v.string()),
  title: v.string(),
  description: v.nullable(v.string()),
  status: v.string(),
  priority: v.picklist([
    "no-priority",
    "low",
    "medium",
    "high",
    "urgent",
  ] as const),
  points: v.optional(v.nullable(v.number())),
  startDate: v.optional(v.date()),
  dueDate: v.optional(v.date()),
  createdAt: v.date(),
  columnId: v.optional(v.nullable(v.string())),
  sprintId: v.optional(v.nullable(v.string())),
  assigneeId: v.optional(v.nullable(v.string())),
  assigneeName: v.optional(v.nullable(v.string())),
});

export const activitySchema = v.object({
  id: v.string(),
  taskId: v.nullable(v.string()),
  sprintId: v.nullable(v.string()),
  type: v.picklist([
    "comment",
    "task",
    "status_changed",
    "priority_changed",
    "unassigned",
    "assignee_changed",
    "due_date_changed",
    "title_changed",
    "description_changed",
    "create",
    "sprint_created",
    "sprint_started",
    "sprint_completed",
    "sprint_changed",
  ] as const),
  createdAt: v.date(),
  userId: v.nullable(v.string()),
  content: v.nullable(v.string()),
  eventData: v.nullable(v.record(v.string(), v.unknown())),
  externalUserName: v.nullable(v.string()),
  externalUserAvatar: v.nullable(v.string()),
  externalSource: v.nullable(v.string()),
  externalUrl: v.nullable(v.string()),
});

export const notificationSchema = v.object({
  id: v.string(),
  userId: v.string(),
  title: v.nullable(v.string()),
  content: v.nullable(v.string()),
  type: v.picklist([
    "info",
    "task_created",
    "workspace_created",
    "task_status_changed",
    "task_assignee_changed",
    "time_entry_created",
    "mention",
    "invitation",
    "due_date_reminder",
    "task_overdue",
    "task_deleted",
  ] as const),
  eventData: v.nullable(v.record(v.string(), v.unknown())),
  isRead: v.optional(v.boolean()),
  resourceId: v.optional(v.string()),
  resourceType: v.optional(
    v.picklist(["task", "workspace", "project"] as const),
  ),
  createdAt: v.date(),
  updatedAt: v.date(),
});

export const notificationPreferenceWorkspaceRuleSchema = v.object({
  id: v.string(),
  workspaceId: v.string(),
  workspaceName: v.string(),
  isActive: v.boolean(),
  emailEnabled: v.boolean(),
  ntfyEnabled: v.boolean(),
  gotifyEnabled: v.boolean(),
  webhookEnabled: v.boolean(),
  projectMode: v.picklist(["all", "selected"] as const),
  selectedProjectIds: v.array(v.string()),
  createdAt: v.date(),
  updatedAt: v.date(),
});

export const notificationPreferenceSchema = v.object({
  emailAddress: v.nullable(v.string()),
  emailEnabled: v.boolean(),
  ntfyEnabled: v.boolean(),
  ntfyConfigured: v.boolean(),
  ntfyServerUrl: v.nullable(v.string()),
  ntfyTopic: v.nullable(v.string()),
  ntfyTokenConfigured: v.boolean(),
  maskedNtfyToken: v.nullable(v.string()),
  gotifyEnabled: v.boolean(),
  gotifyConfigured: v.boolean(),
  gotifyServerUrl: v.nullable(v.string()),
  gotifyTokenConfigured: v.boolean(),
  maskedGotifyToken: v.nullable(v.string()),
  webhookEnabled: v.boolean(),
  webhookConfigured: v.boolean(),
  webhookUrl: v.nullable(v.string()),
  webhookSecretConfigured: v.boolean(),
  maskedWebhookSecret: v.nullable(v.string()),
  workspaces: v.array(notificationPreferenceWorkspaceRuleSchema),
  createdAt: v.nullable(v.date()),
  updatedAt: v.nullable(v.date()),
});

export const githubIntegrationSchema = v.object({
  id: v.string(),
  projectId: v.string(),
  repositoryOwner: v.string(),
  repositoryName: v.string(),
  installationId: v.nullable(v.number()),
  branchPattern: v.optional(v.string()),
  commentTaskLinkOnGitHubIssue: v.optional(v.boolean()),
  isActive: v.nullable(v.boolean()),
  createdAt: v.date(),
  updatedAt: v.date(),
});

export const giteaIntegrationSchema = v.object({
  id: v.string(),
  projectId: v.string(),
  baseUrl: v.string(),
  repositoryOwner: v.string(),
  repositoryName: v.string(),
  maskedAccessToken: v.string(),
  webhookUrl: v.optional(v.string()),
  webhookSecret: v.optional(v.string()),
  branchPattern: v.optional(v.string()),
  commentTaskLinkOnGiteaIssue: v.optional(v.boolean()),
  isActive: v.nullable(v.boolean()),
  createdAt: v.date(),
  updatedAt: v.date(),
});

export const integrationEventsSchema = v.object({
  taskCreated: v.boolean(),
  taskStatusChanged: v.boolean(),
  taskPriorityChanged: v.boolean(),
  taskTitleChanged: v.boolean(),
  taskDescriptionChanged: v.boolean(),
  taskCommentCreated: v.boolean(),
});

export const genericWebhookIntegrationSchema = v.object({
  id: v.string(),
  projectId: v.string(),
  webhookConfigured: v.boolean(),
  maskedWebhookUrl: v.nullable(v.string()),
  secretConfigured: v.boolean(),
  maskedSecret: v.nullable(v.string()),
  events: integrationEventsSchema,
  isActive: v.nullable(v.boolean()),
  createdAt: v.date(),
  updatedAt: v.date(),
});

export const commentSchema = v.object({
  id: v.string(),
  taskId: v.string(),
  userId: v.string(),
  content: v.string(),
  createdAt: v.date(),
  updatedAt: v.date(),
  user: v.optional(
    v.object({
      name: v.string(),
      image: v.nullable(v.string()),
    }),
  ),
});

export const configSchema = v.object({
  disableRegistration: v.nullable(v.boolean()),
  disablePasswordRegistration: v.nullable(v.boolean()),
  isDemoMode: v.boolean(),
  hasSmtp: v.boolean(),
  hasGithubSignIn: v.nullable(v.boolean()),
  hasGoogleSignIn: v.nullable(v.boolean()),
  hasCustomOAuth: v.nullable(v.boolean()),
  hasGuestAccess: v.nullable(v.boolean()),
  customOAuthLogoutUrl: v.nullable(v.string()),
});

export const workspaceDashboardSchema = v.object({
  stats: v.object({
    total: v.number(),
    open: v.number(),
    completed: v.number(),
    overdue: v.number(),
  }),
  members: v.array(
    v.object({
      userId: v.string(),
      name: v.string(),
      open: v.number(),
      overdue: v.number(),
      completed: v.number(),
      total: v.number(),
    }),
  ),
  activeSprints: v.array(
    v.object({
      id: v.string(),
      name: v.string(),
      endDate: v.nullable(v.date()),
      totalTasks: v.number(),
      completedTasks: v.number(),
      totalPoints: v.number(),
      completedPoints: v.number(),
    }),
  ),
  projects: v.array(
    v.object({
      id: v.string(),
      name: v.string(),
      slug: v.string(),
      totalTasks: v.number(),
      completedTasks: v.number(),
    }),
  ),
});

export const timeEntrySchema = v.object({
  id: v.string(),
  taskId: v.string(),
  userId: v.nullable(v.string()),
  description: v.nullable(v.string()),
  startTime: v.date(),
  endTime: v.optional(v.date()),
  duration: v.nullable(v.number()),
  createdAt: v.date(),
  updatedAt: v.date(),
});

export const discordIntegrationSchema = v.object({
  id: v.string(),
  projectId: v.string(),
  channelName: v.nullable(v.string()),
  webhookConfigured: v.boolean(),
  maskedWebhookUrl: v.string(),
  events: integrationEventsSchema,
  isActive: v.nullable(v.boolean()),
  createdAt: v.date(),
  updatedAt: v.date(),
});

export const slackIntegrationSchema = v.object({
  id: v.string(),
  projectId: v.string(),
  channelName: v.nullable(v.string()),
  webhookConfigured: v.boolean(),
  maskedWebhookUrl: v.string(),
  events: integrationEventsSchema,
  isActive: v.nullable(v.boolean()),
  createdAt: v.date(),
  updatedAt: v.date(),
});

export const telegramIntegrationSchema = v.object({
  id: v.string(),
  projectId: v.string(),
  chatId: v.string(),
  threadId: v.nullable(v.number()),
  chatLabel: v.nullable(v.string()),
  botTokenConfigured: v.boolean(),
  maskedBotToken: v.string(),
  events: integrationEventsSchema,
  isActive: v.nullable(v.boolean()),
  createdAt: v.date(),
  updatedAt: v.date(),
});
