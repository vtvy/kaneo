import { and, eq } from "drizzle-orm";
import db from "../../../database";
import { integrationTable } from "../../../database/schema";
import type { GitlabConfig } from "../config";
import { normalizeGitlabBaseUrl } from "../config";

/**
 * Returns the integration that received the webhook, provided its configured
 * project matches the payload. Only the integration whose secret matched the
 * request is eligible: another project linking the same GitLab repository
 * must never act on events authenticated by someone else's secret.
 */
export async function findAllIntegrationsByGitlabRepo(
  baseUrl: string,
  owner: string,
  repo: string,
  integrationId: string,
) {
  const normalized = normalizeGitlabBaseUrl(baseUrl);
  const integrations = await db.query.integrationTable.findMany({
    where: and(
      eq(integrationTable.id, integrationId),
      eq(integrationTable.type, "gitlab"),
      eq(integrationTable.isActive, true),
    ),
    with: {
      project: true,
    },
  });

  const ownerKey = owner.trim().toLowerCase();
  const repoKey = repo.trim().toLowerCase();

  return integrations.filter((integration) => {
    try {
      const config = JSON.parse(integration.config) as GitlabConfig;
      const configOwner = config.repositoryOwner?.trim().toLowerCase() ?? "";
      const configRepo = config.repositoryName?.trim().toLowerCase() ?? "";
      if (configOwner !== ownerKey || configRepo !== repoKey) {
        console.warn("[GitLab Webhook] Project path does not match", {
          integrationId: integration.id,
        });
        return false;
      }
      // GitLab reports its own public hostname in web_url, which may differ
      // from the URL the integration was connected with (LAN IP vs DNS).
      // The secret already identifies the integration, so the namespace/path
      // match above is sufficient.
      if (normalizeGitlabBaseUrl(config.baseUrl) !== normalized) {
        console.warn(
          "[GitLab Webhook] Matching by project path despite host mismatch",
          { integrationId: integration.id },
        );
      }
      return true;
    } catch {
      return false;
    }
  });
}

export function repoOwnerLogin(repo: {
  owner?: { login?: string; username?: string };
}): string {
  return repo.owner?.login ?? repo.owner?.username ?? "";
}
