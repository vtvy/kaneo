import type { PluginContext, TaskCreatedEvent } from "../../types";
import type { GitlabConfig } from "../config";
import { createGitlabIssueFromTask } from "../services/create-issue-from-task";

export async function handleTaskCreated(
  event: TaskCreatedEvent,
  context: PluginContext,
): Promise<void> {
  // Opt-in only: create-task toggle or explicit push. Avoid BA surprise issues.
  if (!event.createGitlabIssue) {
    return;
  }

  const config = context.config as GitlabConfig;
  if (!config.baseUrl || !config.accessToken) {
    return;
  }

  try {
    await createGitlabIssueFromTask({
      config,
      integrationId: context.integrationId,
      taskId: event.taskId,
      title: event.title,
      description: event.description,
      priority: event.priority,
      status: event.status,
    });
  } catch (error) {
    console.error("Failed to create GitLab issue:", error);
  }
}
