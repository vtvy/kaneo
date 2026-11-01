import { HTTPException } from "hono/http-exception";
import { assertValidGitlabBaseUrl } from "../../plugins/gitlab/config";
import {
  createGitlabClient,
  GitlabApiError,
  verifyGitlabToken,
} from "../../plugins/gitlab/utils/gitlab-api";

type RepoRow = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  owner: { login: string };
  html_url: string;
};

async function listGitlabRepositories({
  baseUrl,
  accessToken,
}: {
  baseUrl: string;
  accessToken: string;
}): Promise<{ repositories: RepoRow[] }> {
  let normalized: string;
  try {
    normalized = assertValidGitlabBaseUrl(baseUrl);
  } catch (error) {
    throw new HTTPException(400, {
      message: error instanceof Error ? error.message : "Invalid GitLab URL",
    });
  }

  try {
    await verifyGitlabToken(normalized, accessToken);
  } catch {
    throw new HTTPException(401, {
      message: "Invalid GitLab token or could not reach instance.",
    });
  }

  const client = createGitlabClient({
    baseUrl: normalized,
    accessToken,
  });

  const all: RepoRow[] = [];
  let page = 1;

  try {
    while (true) {
      const batch = await client.listUserRepos(page, 50);
      if (!batch.length) break;

      for (const repo of batch) {
        all.push({
          id: repo.id,
          name: repo.name,
          full_name: repo.full_name,
          private: repo.private,
          owner: { login: repo.owner.login },
          html_url: repo.html_url,
        });
      }

      if (batch.length < 50) break;
      page += 1;
      if (page > 50) break;
    }
  } catch (error) {
    if (error instanceof GitlabApiError) {
      throw new HTTPException(400, { message: error.message });
    }
    throw error;
  }

  return { repositories: all };
}

export default listGitlabRepositories;
