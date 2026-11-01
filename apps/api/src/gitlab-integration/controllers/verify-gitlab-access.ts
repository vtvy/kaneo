import { HTTPException } from "hono/http-exception";
import {
  assertValidGitlabBaseUrl,
  normalizeGitlabNamespace,
  normalizeGitlabProjectName,
} from "../../plugins/gitlab/config";
import {
  createGitlabClient,
  GitlabApiError,
  verifyGitlabToken,
} from "../../plugins/gitlab/utils/gitlab-api";

async function verifyGitlabAccess({
  baseUrl,
  accessToken,
  repositoryOwner,
  repositoryName,
}: {
  baseUrl: string;
  accessToken: string;
  repositoryOwner: string;
  repositoryName: string;
}) {
  let normalized: string;
  let owner: string;
  let name: string;
  try {
    normalized = assertValidGitlabBaseUrl(baseUrl);
    owner = normalizeGitlabNamespace(repositoryOwner);
    name = normalizeGitlabProjectName(repositoryName);
  } catch (error) {
    throw new HTTPException(400, {
      message: error instanceof Error ? error.message : "Invalid GitLab input",
    });
  }

  try {
    await verifyGitlabToken(normalized, accessToken);

    const client = createGitlabClient({
      baseUrl: normalized,
      accessToken,
    });

    const repo = await client.getRepo(owner, name);

    const perms = repo.permissions;
    const hasIssuesWrite = perms?.admin === true || perms?.push === true;

    return {
      isInstalled: true,
      hasRequiredPermissions: Boolean(hasIssuesWrite),
      repositoryExists: true,
      repositoryPrivate: repo.private,
      missingPermissions: hasIssuesWrite ? [] : ["issues (write)"],
      message: hasIssuesWrite
        ? "Token can access the repository."
        : "Token may not have sufficient permissions to manage issues.",
    };
  } catch (error) {
    if (!(error instanceof GitlabApiError)) {
      console.error("[GitLab] Verify access failed:", error);
      throw new HTTPException(500, {
        message: "Failed to verify GitLab access",
      });
    }

    if (error.status === 404) {
      return {
        isInstalled: false,
        hasRequiredPermissions: false,
        repositoryExists: false,
        repositoryPrivate: null,
        missingPermissions: [] as string[],
        message: "Repository not found or not accessible with this token.",
      };
    }

    if (error.status === 401 || error.status === 403) {
      throw new HTTPException(401, {
        message: "Invalid GitLab token or unauthorized.",
      });
    }

    // GitlabApiError messages are short and generic (SSRF guard, redirect,
    // timeout, unreachable, "GitLab API error 502"); the upstream body is
    // never included. These are configuration problems, not server bugs.
    throw new HTTPException(400, { message: error.message });
  }
}

export default verifyGitlabAccess;
