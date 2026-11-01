import {
  createExternalLink,
  findExternalLinkByTaskAndType,
} from "../../github/services/link-manager";
import {
  formatIssueBody,
  formatIssueTitle,
  getLabelsForIssue,
} from "../../github/utils/format";
import type { GitlabConfig } from "../config";
import { createGitlabClient } from "../utils/gitlab-api";
import { addLabelsToIssueGitlab } from "../utils/labels";
import { rewriteGitlabUrl } from "../utils/rewrite-url";

export async function createGitlabIssueFromTask({
  config,
  integrationId,
  taskId,
  title,
  description,
  priority,
  status,
}: {
  config: GitlabConfig;
  integrationId: string;
  taskId: string;
  title: string;
  description: string | null;
  priority: string | null;
  status: string | null;
}) {
  const existingLink = await findExternalLinkByTaskAndType(
    taskId,
    integrationId,
    "issue",
  );

  if (existingLink) {
    return {
      created: false as const,
      issueNumber: existingLink.externalId,
      url: existingLink.url,
    };
  }

  const { repositoryOwner, repositoryName } = config;
  const client = createGitlabClient(config);
  const createdIssue = await client.createIssue(
    repositoryOwner,
    repositoryName,
    {
      title: formatIssueTitle(title),
      body: formatIssueBody(description, taskId),
    },
  );

  const url = rewriteGitlabUrl(config.baseUrl, createdIssue.html_url);

  await createExternalLink({
    taskId,
    integrationId,
    resourceType: "issue",
    externalId: createdIssue.number.toString(),
    url,
    title: createdIssue.title,
    metadata: {
      state: createdIssue.state,
      createdFrom: "gitlab",
      lastOutboundStateSyncAt: Date.now(),
    },
  });

  const labels = getLabelsForIssue(priority, status);
  await addLabelsToIssueGitlab(config, createdIssue.number, labels);

  return {
    created: true as const,
    issueNumber: createdIssue.number.toString(),
    url,
  };
}
