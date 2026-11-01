import { publishEvent } from "../../../events";
import { createOrUpdateExternalLink } from "../../github/services/link-manager";
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
import { extractTaskNumberFromBranchGitlab } from "../utils/branch-matcher";
import { resolveTargetStatus } from "../utils/resolve-column";
import { rewriteGitlabUrl } from "../utils/rewrite-url";
import { baseUrlFromRepositoryHtmlUrl } from "../utils/webhook-repo";

type PushPayload = {
  ref: string;
  head_commit?: {
    id: string;
    message: string;
    author?: { name: string };
    timestamp: string;
  };
  commits?: Array<{
    id: string;
    message: string;
    author?: { name: string; username?: string };
    timestamp?: string;
  }>;
  repository: {
    owner: { login?: string; username?: string };
    name: string;
    html_url: string;
  };
};

const PROTECTED_BRANCHES = [
  "main",
  "master",
  "develop",
  "staging",
  "production",
];

export async function handleGitlabPush(
  payload: PushPayload,
  integrationId: string,
) {
  const { ref, repository } = payload;

  if (!ref.startsWith("refs/heads/")) {
    console.log(`[GitLab Push] Skipping non-branch ref: ${ref}`);
    return;
  }

  const branchName = ref.slice("refs/heads/".length);
  console.log(`[GitLab Push] Processing branch: ${branchName}`);

  if (PROTECTED_BRANCHES.includes(branchName)) {
    console.log(`[GitLab Push] Skipping protected branch: ${branchName}`);
    return;
  }

  const origin = baseUrlFromRepositoryHtmlUrl(repository.html_url);
  if (!origin) {
    return;
  }
  const owner = repoOwnerLogin(repository);
  const integrations = await findAllIntegrationsByGitlabRepo(
    origin,
    owner,
    repository.name,
    integrationId,
  );

  if (integrations.length === 0) {
    return;
  }

  const headCommit =
    payload.head_commit ?? payload.commits?.[payload.commits.length - 1];

  for (const integration of integrations) {
    if (!integration.project) {
      continue;
    }

    let config: GitlabConfig;
    try {
      config = JSON.parse(integration.config) as GitlabConfig;
    } catch (error) {
      console.error("Invalid GitLab integration config for push webhook", {
        integrationId: integration.id,
        error,
      });
      continue;
    }
    const projectSlug = integration.project.slug;

    const taskNumber = extractTaskNumberFromBranchGitlab(
      branchName,
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

    const projectUrl = rewriteGitlabUrl(config.baseUrl, repository.html_url);
    const treeUrl = `${projectUrl}/-/tree/${encodeURIComponent(branchName)}`;

    await createOrUpdateExternalLink({
      taskId: task.id,
      integrationId: integration.id,
      resourceType: "branch",
      externalId: branchName,
      url: treeUrl,
      title: branchName,
      metadata: {
        lastCommit: headCommit
          ? {
              sha: headCommit.id,
              message: headCommit.message,
              author: headCommit.author?.name,
              timestamp:
                "timestamp" in headCommit ? headCommit.timestamp : undefined,
            }
          : null,
      },
    });

    const targetStatus = await resolveTargetStatus(
      integration.projectId,
      "branch_push",
      config.statusTransitions?.onBranchPush || "in-progress",
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
  }
}
