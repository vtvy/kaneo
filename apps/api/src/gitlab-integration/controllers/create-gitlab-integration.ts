import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { integrationTable, projectTable } from "../../database/schema";
import {
  assertValidGitlabBaseUrl,
  type GitlabConfig,
  getDefaultGitlabConfig,
  normalizeGitlabBaseUrl,
  normalizeGitlabNamespace,
  normalizeGitlabProjectName,
  validateGitlabConfig,
} from "../../plugins/gitlab/config";
import {
  createGitlabClient,
  GitlabApiError,
  verifyGitlabToken,
} from "../../plugins/gitlab/utils/gitlab-api";

async function createGitlabIntegration({
  projectId,
  baseUrl,
  accessToken,
  repositoryOwner: rawOwner,
  repositoryName: rawName,
}: {
  projectId: string;
  baseUrl: string;
  accessToken: string | undefined;
  repositoryOwner: string;
  repositoryName: string;
}) {
  const project = await db.query.projectTable.findFirst({
    where: eq(projectTable.id, projectId),
  });

  if (!project) {
    throw new HTTPException(404, { message: "Project not found" });
  }

  let normalizedBase: string;
  let repositoryOwner: string;
  let repositoryName: string;
  try {
    normalizedBase = assertValidGitlabBaseUrl(baseUrl);
    repositoryOwner = normalizeGitlabNamespace(rawOwner);
    repositoryName = normalizeGitlabProjectName(rawName);
  } catch (error) {
    throw new HTTPException(400, {
      message: error instanceof Error ? error.message : "Invalid GitLab input",
    });
  }

  const existingIntegration = await db.query.integrationTable.findFirst({
    where: and(
      eq(integrationTable.projectId, projectId),
      eq(integrationTable.type, "gitlab"),
    ),
  });

  let resolvedToken = accessToken?.trim() ?? "";
  if (!resolvedToken && existingIntegration) {
    try {
      const prev = JSON.parse(existingIntegration.config) as GitlabConfig;
      // Only reuse the stored token for the same instance, so changing the
      // URL can't send it to a different host.
      if (normalizeGitlabBaseUrl(prev.baseUrl) === normalizedBase) {
        resolvedToken = prev.accessToken;
      }
    } catch (error) {
      console.warn("Failed to parse existing GitLab integration config", {
        integrationId: existingIntegration.id,
        error,
      });
    }
  }

  if (!resolvedToken) {
    throw new HTTPException(400, {
      message: "Personal access token is required",
    });
  }

  try {
    await verifyGitlabToken(normalizedBase, resolvedToken);

    const client = createGitlabClient({
      baseUrl: normalizedBase,
      accessToken: resolvedToken,
    });
    await client.getRepo(repositoryOwner, repositoryName);
  } catch (error) {
    if (error instanceof GitlabApiError) {
      // GitLab 401/403 means a bad token, not a Kaneo auth failure.
      const status = error.status === 404 ? 404 : 400;
      throw new HTTPException(status, { message: error.message });
    }
    throw error;
  }

  const allGitlab = await db.query.integrationTable.findMany({
    where: eq(integrationTable.type, "gitlab"),
  });

  for (const integration of allGitlab) {
    if (integration.projectId === projectId) {
      continue;
    }
    if (!integration.isActive) {
      continue;
    }
    try {
      const cfg = JSON.parse(integration.config) as {
        baseUrl?: string;
        repositoryOwner?: string;
        repositoryName?: string;
      };
      if (
        normalizeGitlabBaseUrl(cfg.baseUrl ?? "") === normalizedBase &&
        cfg.repositoryOwner === repositoryOwner &&
        cfg.repositoryName === repositoryName
      ) {
        throw new HTTPException(409, {
          message: `Repository ${repositoryOwner}/${repositoryName} on this GitLab instance is already linked to another project`,
        });
      }
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error;
      }
      console.warn(
        "Skipping invalid GitLab integration config during conflict check",
        {
          integrationId: integration.id,
          error,
        },
      );
    }
  }

  let webhookSecret = randomBytes(24).toString("hex");
  if (existingIntegration) {
    try {
      const previousConfig = JSON.parse(
        existingIntegration.config,
      ) as GitlabConfig;
      webhookSecret = previousConfig.webhookSecret ?? webhookSecret;
    } catch (error) {
      console.warn(
        "Failed to parse existing GitLab config for webhook secret",
        {
          integrationId: existingIntegration.id,
          error,
        },
      );
    }
  }

  const config: GitlabConfig = getDefaultGitlabConfig(
    normalizedBase,
    resolvedToken,
    repositoryOwner,
    repositoryName,
    webhookSecret,
  );

  const validation = await validateGitlabConfig(config);
  if (!validation.valid) {
    throw new HTTPException(400, {
      message: validation.errors?.join(", ") ?? "Invalid config",
    });
  }

  if (existingIntegration) {
    const [updated] = await db
      .update(integrationTable)
      .set({
        config: JSON.stringify(config),
        isActive: true,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(integrationTable.projectId, projectId),
          eq(integrationTable.type, "gitlab"),
        ),
      )
      .returning();

    if (!updated) {
      throw new HTTPException(500, {
        message: "Failed to update GitLab integration",
      });
    }

    return {
      id: updated.id,
      projectId: updated.projectId,
      baseUrl: normalizedBase,
      repositoryOwner,
      repositoryName,
      webhookSecret,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  const [newIntegration] = await db
    .insert(integrationTable)
    .values({
      projectId,
      type: "gitlab",
      config: JSON.stringify(config),
      isActive: true,
    })
    .returning();

  if (!newIntegration) {
    throw new HTTPException(500, {
      message: "Failed to create GitLab integration",
    });
  }

  return {
    id: newIntegration.id,
    projectId: newIntegration.projectId,
    baseUrl: normalizedBase,
    repositoryOwner,
    repositoryName,
    webhookSecret,
    isActive: newIntegration.isActive,
    createdAt: newIntegration.createdAt,
    updatedAt: newIntegration.updatedAt,
  };
}

export default createGitlabIntegration;
