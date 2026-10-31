import { and, eq } from "drizzle-orm";
import db from "../../../database";
import { integrationTable } from "../../../database/schema";
import type { GiteaConfig } from "../config";
import { normalizeGiteaBaseUrl } from "../config";

// Only the integration whose webhook secret signed the request is eligible:
// another workspace linking the same repo must not receive forged events.
export async function findAllIntegrationsByGiteaRepo(
  baseUrl: string,
  owner: string,
  repo: string,
  integrationId: string,
) {
  const normalized = normalizeGiteaBaseUrl(baseUrl);
  const integrations = await db.query.integrationTable.findMany({
    where: and(
      eq(integrationTable.id, integrationId),
      eq(integrationTable.type, "gitea"),
      eq(integrationTable.isActive, true),
    ),
    with: {
      project: true,
    },
  });

  return integrations.filter((integration) => {
    try {
      const config = JSON.parse(integration.config) as GiteaConfig;
      return (
        normalizeGiteaBaseUrl(config.baseUrl) === normalized &&
        config.repositoryOwner === owner &&
        config.repositoryName === repo
      );
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
