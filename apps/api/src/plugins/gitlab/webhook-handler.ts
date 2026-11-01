import { eq } from "drizzle-orm";
import db from "../../database";
import { integrationTable } from "../../database/schema";
import type { GitlabConfig } from "./config";
import { normalizeGitlabWebhookPayload } from "./utils/normalize-webhook-payload";
import { verifyGitlabWebhookToken } from "./utils/verify-signature";
import { handleGitlabIssueClosed } from "./webhooks/issue-closed";
import { handleGitlabIssueCommentCreated } from "./webhooks/issue-comment-created";
import { handleGitlabIssueEdited } from "./webhooks/issue-edited";
import { handleGitlabIssueLabeled } from "./webhooks/issue-labeled";
import { handleGitlabIssueOpened } from "./webhooks/issue-opened";
import { handleGitlabIssueReopened } from "./webhooks/issue-reopened";
import { handleGitlabLabelCreated } from "./webhooks/label-created";
import { handleGitlabPullRequestClosed } from "./webhooks/pull-request-closed";
import { handleGitlabPullRequestOpened } from "./webhooks/pull-request-opened";
import { handleGitlabPush } from "./webhooks/push";

type GitlabPushPayload = Parameters<typeof handleGitlabPush>[0];
type GitlabPullRequestPayload = Parameters<
  typeof handleGitlabPullRequestOpened
>[0];
type GitlabPullRequestClosedPayload = Parameters<
  typeof handleGitlabPullRequestClosed
>[0];
type GitlabIssuePayload = Parameters<typeof handleGitlabIssueOpened>[0];
type GitlabIssueClosedPayload = Parameters<typeof handleGitlabIssueClosed>[0];
type GitlabIssueReopenedPayload = Parameters<
  typeof handleGitlabIssueReopened
>[0];
type GitlabIssueCommentPayload = Parameters<
  typeof handleGitlabIssueCommentCreated
>[0];
type GitlabLabelPayload = Parameters<typeof handleGitlabLabelCreated>[0];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasRepository(value: Record<string, unknown>) {
  return isRecord(value.repository);
}

function isPushPayload(
  payload: Record<string, unknown>,
): payload is GitlabPushPayload {
  return typeof payload.ref === "string" && hasRepository(payload);
}

function isPullRequestPayload(
  payload: Record<string, unknown>,
): payload is GitlabPullRequestPayload {
  return hasRepository(payload) && isRecord(payload.pull_request);
}

function isIssuePayload(
  payload: Record<string, unknown>,
): payload is GitlabIssuePayload {
  return hasRepository(payload) && isRecord(payload.issue);
}

function isIssueCommentPayload(
  payload: Record<string, unknown>,
): payload is GitlabIssueCommentPayload {
  return (
    hasRepository(payload) &&
    isRecord(payload.issue) &&
    isRecord(payload.comment)
  );
}

function isLabelPayload(
  payload: Record<string, unknown>,
): payload is GitlabLabelPayload {
  return hasRepository(payload);
}

export async function handleGitlabWebhookRequest(
  integrationId: string,
  rawBody: string,
  tokenHeader: string | undefined,
  eventHeader: string | undefined,
): Promise<{
  success: boolean;
  error?: string;
  status?: 400 | 401 | 404 | 500;
}> {
  const integration = await db.query.integrationTable.findFirst({
    where: eq(integrationTable.id, integrationId),
  });

  if (!integration || integration.type !== "gitlab") {
    return {
      success: false,
      error: "GitLab integration not found",
      status: 404,
    };
  }

  let config: GitlabConfig;
  try {
    config = JSON.parse(integration.config) as GitlabConfig;
  } catch {
    return { success: false, error: "Invalid integration config" };
  }

  const secret = config.webhookSecret;
  if (!secret) {
    return { success: false, error: "Webhook secret not configured" };
  }

  if (!verifyGitlabWebhookToken(secret, tokenHeader)) {
    return { success: false, error: "Invalid webhook token", status: 401 };
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return { success: false, error: "Invalid JSON payload" };
  }

  const normalized = normalizeGitlabWebhookPayload(eventHeader || "", payload);
  if (!normalized.event) {
    return { success: false, error: "Missing event name" };
  }

  try {
    await dispatchGitlabEvent(
      normalized.event,
      normalized.payload,
      integration.id,
    );
    return { success: true };
  } catch (error) {
    // The request itself was valid; details stay in the server log.
    console.error("[GitLab Webhook] Handler error:", error);
    return { success: false, error: "Webhook handler failed", status: 500 };
  }
}

async function dispatchGitlabEvent(
  event: string,
  payload: Record<string, unknown>,
  integrationId: string,
) {
  console.log(`[GitLab Webhook] Event: ${event}`);

  switch (event) {
    case "push":
      if (isPushPayload(payload)) {
        await handleGitlabPush(payload, integrationId);
      }
      return;
    case "pull_request": {
      const action = payload.action as string | undefined;
      if (
        action === "opened" ||
        action === "reopened" ||
        action === "ready_for_review"
      ) {
        if (isPullRequestPayload(payload)) {
          await handleGitlabPullRequestOpened(payload, integrationId);
        }
      } else if (action === "closed" && isPullRequestPayload(payload)) {
        await handleGitlabPullRequestClosed(
          payload as unknown as GitlabPullRequestClosedPayload,
          integrationId,
        );
      }
      return;
    }
    case "issues": {
      const action = payload.action as string | undefined;
      // GitLab uses "created" for new issues; GitHub-style is "opened"
      if (
        (action === "opened" || action === "created") &&
        isIssuePayload(payload)
      ) {
        await handleGitlabIssueOpened(payload, integrationId);
      } else if (action === "reopened" && isIssuePayload(payload)) {
        await handleGitlabIssueReopened(
          payload as unknown as GitlabIssueReopenedPayload,
          integrationId,
        );
      } else if (action === "closed" && isIssuePayload(payload)) {
        await handleGitlabIssueClosed(
          payload as unknown as GitlabIssueClosedPayload,
          integrationId,
        );
      } else if (action === "edited" && isIssuePayload(payload)) {
        await handleGitlabIssueEdited(payload, integrationId);
      } else if (
        isIssuePayload(payload) &&
        (action === "labeled" ||
          action === "unlabeled" ||
          action === "label_updated")
      ) {
        await handleGitlabIssueLabeled(
          {
            ...payload,
            action: action ?? "",
          },
          integrationId,
        );
      }
      return;
    }
    case "issue_comment": {
      const action = payload.action as string | undefined;
      if (action === "created" && isIssueCommentPayload(payload)) {
        await handleGitlabIssueCommentCreated(payload, integrationId);
      }
      return;
    }
    case "issue_label": {
      if (isLabelPayload(payload)) {
        await handleGitlabLabelCreated(payload, integrationId);
      }
      return;
    }
    default:
      console.log(`[GitLab Webhook] Ignored event: ${event}`);
  }
}
