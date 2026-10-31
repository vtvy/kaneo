import { HTTPException } from "hono/http-exception";
import { normalizeGiteaBaseUrl } from "../../plugins/gitea/config";
import {
  createGiteaClient,
  GiteaApiError,
  verifyGiteaToken,
} from "../../plugins/gitea/utils/gitea-api";

async function verifyGiteaAccess({
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
  try {
    const normalized = normalizeGiteaBaseUrl(baseUrl);
    await verifyGiteaToken(normalized, accessToken);

    const client = createGiteaClient({
      baseUrl: normalized,
      accessToken,
    });

    const repo = await client.getRepo(repositoryOwner, repositoryName);

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
    const err = error as { status?: number; message?: string };

    if (err.status === 404) {
      return {
        isInstalled: false,
        hasRequiredPermissions: false,
        repositoryExists: false,
        repositoryPrivate: null,
        missingPermissions: [] as string[],
        message: "Repository not found or not accessible with this token.",
      };
    }

    if (err.status === 401) {
      throw new HTTPException(401, {
        message: "Invalid Gitea token or unauthorized.",
      });
    }

    // GiteaApiError messages are short and generic ("Gitea API error 502");
    // anything else may carry internal detail, so it is not echoed back.
    throw new HTTPException(500, {
      message:
        error instanceof GiteaApiError
          ? error.message
          : "Failed to verify Gitea access",
    });
  }
}

export default verifyGiteaAccess;
