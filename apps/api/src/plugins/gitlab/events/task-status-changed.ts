import {
  findExternalLinksByTask,
  updateExternalLink,
} from "../../github/services/link-manager";
import type { PluginContext, TaskStatusChangedEvent } from "../../types";
import type { GitlabConfig } from "../config";
import { createGitlabClient } from "../utils/gitlab-api";
import { addLabelsToIssueGitlab, removeLabelGitlab } from "../utils/labels";

export async function handleTaskStatusChanged(
  event: TaskStatusChangedEvent,
  context: PluginContext,
): Promise<void> {
  const config = context.config as GitlabConfig;
  if (!config.baseUrl || !config.accessToken) {
    return;
  }

  const { repositoryOwner, repositoryName } = config;

  try {
    const links = await findExternalLinksByTask(event.taskId);
    const issueLink = links.find(
      (link) =>
        link.integrationId === context.integrationId &&
        link.resourceType === "issue",
    );

    if (!issueLink) {
      return;
    }

    const client = createGitlabClient(config);
    const issueNumber = Number.parseInt(issueLink.externalId, 10);

    if (event.oldStatus) {
      await removeLabelGitlab(config, issueNumber, `status:${event.oldStatus}`);
    }

    if (event.newStatus) {
      await addLabelsToIssueGitlab(config, issueNumber, [
        `status:${event.newStatus}`,
      ]);
    }

    if (event.newStatus === "done") {
      await client.updateIssue(repositoryOwner, repositoryName, issueNumber, {
        state: "closed",
      });

      await updateExternalLink(issueLink.id, {
        metadata: {
          ...(issueLink.metadata ? JSON.parse(issueLink.metadata) : {}),
          state: "closed",
          lastOutboundStateSyncAt: Date.now(),
        },
      });
    } else if (event.oldStatus === "done" && event.newStatus !== "done") {
      await client.updateIssue(repositoryOwner, repositoryName, issueNumber, {
        state: "open",
      });

      await updateExternalLink(issueLink.id, {
        metadata: {
          ...(issueLink.metadata ? JSON.parse(issueLink.metadata) : {}),
          state: "open",
          lastOutboundStateSyncAt: Date.now(),
        },
      });
    }
  } catch (error) {
    console.error("Failed to update GitLab issue status:", error);
  }
}
