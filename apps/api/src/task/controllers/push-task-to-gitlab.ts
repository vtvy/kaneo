import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { integrationTable, taskTable } from "../../database/schema";
import type { GitlabConfig } from "../../plugins/gitlab/config";
import { createGitlabIssueFromTask } from "../../plugins/gitlab/services/create-issue-from-task";
import { GitlabApiError } from "../../plugins/gitlab/utils/gitlab-api";

async function pushTaskToGitlab(taskId: string) {
  const task = await db.query.taskTable.findFirst({
    where: eq(taskTable.id, taskId),
  });

  if (!task) {
    throw new HTTPException(404, { message: "Task not found" });
  }

  const integration = await db.query.integrationTable.findFirst({
    where: and(
      eq(integrationTable.projectId, task.projectId),
      eq(integrationTable.type, "gitlab"),
      eq(integrationTable.isActive, true),
    ),
  });

  if (!integration) {
    throw new HTTPException(400, {
      message: "GitLab integration is not connected for this project",
    });
  }

  let config: GitlabConfig;
  try {
    config = JSON.parse(integration.config) as GitlabConfig;
  } catch {
    throw new HTTPException(400, {
      message: "Invalid GitLab integration config",
    });
  }

  if (!config.baseUrl || !config.accessToken) {
    throw new HTTPException(400, {
      message: "GitLab integration is missing base URL or access token",
    });
  }

  try {
    const result = await createGitlabIssueFromTask({
      config,
      integrationId: integration.id,
      taskId: task.id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: task.status,
    });

    return {
      taskId: task.id,
      issueNumber: result.issueNumber,
      url: result.url,
      created: result.created,
    };
  } catch (error) {
    // GitlabApiError messages are short and generic; anything else may carry
    // internal detail, so it is logged rather than returned.
    if (!(error instanceof GitlabApiError)) {
      console.error("[GitLab] Push task failed:", error);
    }
    throw new HTTPException(502, {
      message:
        error instanceof GitlabApiError
          ? error.message
          : "Failed to create GitLab issue",
    });
  }
}

export default pushTaskToGitlab;
