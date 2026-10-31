import { publishEvent } from "../../../events";
import {
  createExternalLink,
  findExternalLink,
} from "../../github/services/link-manager";
import {
  findTaskByNumber,
  isTaskInFinalState,
  updateTaskStatus,
} from "../../github/services/task-service";
import type { GitlabConfig } from "../config";
import {
  findAllIntegrationsByGitlabRepo,
  repoOwnerLogin,
} from "../services/integration-lookup";
import { extractTaskNumberGitlab } from "../utils/branch-matcher";
import { resolveTargetStatus } from "../utils/resolve-column";
import { rewriteGitlabUrl } from "../utils/rewrite-url";
import { baseUrlFromRepositoryHtmlUrl } from "../utils/webhook-repo";

type PROpenedPayload = {
  action: string;
  pull_request: {
    number: number;
    title: string;
    body: string | null;
    html_url: string;
    state: string;
    draft?: boolean;
    merged?: boolean;
    head: {
      ref: string;
    };
    user: { login?: string; username?: string } | null;
  };
  repository: {
    owner: { login?: string; username?: string };
    name: string;
    html_url: string;
  };
};

export async function handleGitlabPullRequestOpened(
  payload: PROpenedPayload,
  integrationId: string,
) {
  const { pull_request, repository } = payload;

  const baseUrl = baseUrlFromRepositoryHtmlUrl(repository.html_url);
  if (!baseUrl) return;

  const owner = repoOwnerLogin(repository);
  const integrations = await findAllIntegrationsByGitlabRepo(
    baseUrl,
    owner,
    repository.name,
    integrationId,
  );

  for (const integration of integrations) {
    if (!integration.project) {
      continue;
    }

    let config: GitlabConfig;
    try {
      config = JSON.parse(integration.config) as GitlabConfig;
    } catch (error) {
      console.error("Invalid GitLab config for integration", {
        integrationId: integration.id,
        error,
      });
      continue;
    }
    const projectSlug = integration.project.slug;
    const branchName = pull_request.head.ref;

    const taskNumber = extractTaskNumberGitlab(
      branchName,
      pull_request.title,
      pull_request.body ?? undefined,
      config,
      projectSlug,
    );

    if (!taskNumber) {
      continue;
    }

    const task = await findTaskByNumber(integration.projectId, taskNumber);

    if (!task) {
      continue;
    }

    const existingLink = await findExternalLink(
      integration.id,
      "pull_request",
      pull_request.number.toString(),
    );

    if (existingLink) {
      continue;
    }

    await createExternalLink({
      taskId: task.id,
      integrationId: integration.id,
      resourceType: "pull_request",
      externalId: pull_request.number.toString(),
      url: rewriteGitlabUrl(config.baseUrl, pull_request.html_url),
      title: pull_request.title,
      metadata: {
        state: pull_request.state,
        draft: pull_request.draft,
        merged: pull_request.merged,
        branch: branchName,
        author: pull_request.user?.login ?? pull_request.user?.username,
      },
    });

    const targetStatus = await resolveTargetStatus(
      integration.projectId,
      "pr_opened",
      config.statusTransitions?.onPROpen || "in-review",
    );

    const isTaskFinal = await isTaskInFinalState({
      ...task,
      status: task.status ?? "",
    });

    if (task.status !== targetStatus && !isTaskFinal) {
      const statusResult = await updateTaskStatus(task.id, targetStatus);
      if (
        statusResult.applied &&
        statusResult.before.status !== statusResult.after.status
      ) {
        await publishEvent("task.status_changed", {
          taskId: statusResult.after.id,
          projectId: statusResult.after.projectId,
          userId: null,
          oldStatus: statusResult.before.status,
          newStatus: statusResult.after.status,
          title: statusResult.after.title,
          assigneeId: statusResult.after.userId,
          type: "status_changed",
        });
      }
    }

    return;
  }
}
