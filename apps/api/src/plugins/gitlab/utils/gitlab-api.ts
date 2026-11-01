import { assertPublicDestination } from "../../../utils/assert-public-destination";
import { publicFetch } from "../../../utils/public-fetch";
import { truncateText } from "../../../utils/truncate-text";
import type { GitlabConfig } from "../config";
import { normalizeGitlabBaseUrl } from "../config";

export type GitlabLabel = {
  id: number;
  name: string;
  color?: string;
};

/** Keep Gitea-shaped fields so shared webhook/event code can reuse them. */
export type GitlabIssue = {
  id: number;
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  state: string;
  labels?: GitlabLabel[];
  user?: { login?: string; username?: string; avatar_url?: string } | null;
  pull_request?: unknown;
};

export type GitlabComment = {
  id: number;
  body: string;
  html_url: string;
  user?: { login?: string; username?: string; avatar_url?: string } | null;
  created_at: string;
};

export type GitlabPullRequest = {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  state: string;
  head?: { ref?: string };
  user?: { login?: string; username?: string; avatar_url?: string } | null;
  merged?: boolean;
  merged_at?: string | null;
};

export class GitlabApiError extends Error {
  /**
   * Start of the upstream response body, for debugging only. It is capped so
   * logging the error can't dump a whole upstream page, and it must never be
   * returned to API clients; `message` stays a short generic summary.
   */
  public body?: string;

  constructor(
    message: string,
    public status: number,
    body?: string,
  ) {
    super(message);
    this.name = "GitlabApiError";
    this.body = body === undefined ? undefined : truncateText(body);
  }
}

function authHeaders(token: string): HeadersInit {
  return {
    "PRIVATE-TOKEN": token,
    "Content-Type": "application/json",
  };
}

const GITLAB_FETCH_TIMEOUT_MS = 10_000;

function projectPath(owner: string, name: string) {
  return `/projects/${encodeURIComponent(`${owner}/${name}`)}`;
}

function mapIssue(raw: {
  id: number;
  iid: number;
  title: string;
  description?: string | null;
  web_url: string;
  state: string;
  labels?: Array<string | { id?: number; name: string; color?: string }>;
  author?: { username?: string; name?: string; avatar_url?: string } | null;
}): GitlabIssue {
  const labels = (raw.labels ?? []).map((label, index) =>
    typeof label === "string"
      ? { id: index, name: label }
      : {
          id: label.id ?? index,
          name: label.name,
          color: label.color,
        },
  );
  return {
    id: raw.id,
    number: raw.iid,
    title: raw.title,
    body: raw.description ?? null,
    html_url: raw.web_url,
    state: raw.state === "opened" ? "open" : raw.state,
    labels,
    user: raw.author
      ? {
          login: raw.author.username,
          username: raw.author.username,
          avatar_url: raw.author.avatar_url,
        }
      : null,
  };
}

function mapNote(
  raw: {
    id: number;
    body: string;
    created_at: string;
    author?: { username?: string; avatar_url?: string } | null;
  },
  issueWebUrl?: string,
): GitlabComment {
  return {
    id: raw.id,
    body: raw.body,
    html_url: issueWebUrl ? `${issueWebUrl}#note_${raw.id}` : "",
    created_at: raw.created_at,
    user: raw.author
      ? {
          login: raw.author.username,
          username: raw.author.username,
          avatar_url: raw.author.avatar_url,
        }
      : null,
  };
}

function mapMergeRequest(raw: {
  iid: number;
  title: string;
  description?: string | null;
  web_url: string;
  state: string;
  source_branch?: string;
  author?: { username?: string; avatar_url?: string } | null;
  merged_at?: string | null;
}): GitlabPullRequest {
  return {
    number: raw.iid,
    title: raw.title,
    body: raw.description ?? null,
    html_url: raw.web_url,
    state: raw.state === "opened" ? "open" : raw.state,
    head: { ref: raw.source_branch },
    user: raw.author
      ? {
          login: raw.author.username,
          username: raw.author.username,
          avatar_url: raw.author.avatar_url,
        }
      : null,
    merged: Boolean(raw.merged_at) || raw.state === "merged",
    merged_at: raw.merged_at ?? null,
  };
}

export async function gitlabFetch<T>(
  baseUrl: string,
  token: string,
  path: string,
  init?: RequestInit,
): Promise<T | undefined> {
  const root = normalizeGitlabBaseUrl(baseUrl);
  const url = `${root}/api/v4${path.startsWith("/") ? path : `/${path}`}`;

  try {
    await assertPublicDestination(root, "GitLab");
  } catch (error) {
    // These messages are short and fixed ("... non-routable address"), so
    // they can be shown to the user; DNS errors are not echoed.
    const message =
      error instanceof Error && error.message.startsWith("GitLab ")
        ? error.message
        : "GitLab destination could not be resolved";
    throw new GitlabApiError(message, 400);
  }

  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, GITLAB_FETCH_TIMEOUT_MS);
  if (init?.signal) {
    if (init.signal.aborted) {
      controller.abort();
    } else {
      init.signal.addEventListener("abort", () => controller.abort(), {
        once: true,
      });
    }
  }

  try {
    const res = await publicFetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        ...authHeaders(token),
        ...init?.headers,
      },
    });

    if (res.status >= 300 && res.status < 400) {
      throw new GitlabApiError(
        `GitLab request was redirected (HTTP ${res.status})`,
        res.status,
      );
    }

    const text = await res.text();
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new GitlabApiError(
        `GitLab API error ${res.status}`,
        res.status,
        text,
      );
    }

    if (res.status === 204 || text === "") {
      return undefined;
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new GitlabApiError(
        "GitLab API returned invalid JSON",
        res.status,
        text,
      );
    }
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof GitlabApiError) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      if (timedOut) {
        throw new GitlabApiError(
          `GitLab request timed out after ${GITLAB_FETCH_TIMEOUT_MS}ms`,
          408,
        );
      }
      throw error;
    }
    // Connection failures (refused, TLS, DNS rebinding guard) are logged
    // server side; the client only learns the instance was unreachable.
    console.error("[GitLab] Request failed:", error);
    throw new GitlabApiError("Could not reach the GitLab instance", 502);
  }
}

export function createGitlabClient(
  config: Pick<GitlabConfig, "baseUrl" | "accessToken">,
) {
  const { baseUrl, accessToken } = config;

  return {
    async getRepo(repositoryOwner: string, repositoryName: string) {
      const project = await gitlabFetch<{
        name: string;
        path_with_namespace: string;
        web_url: string;
        visibility: string;
        permissions?: {
          project_access?: { access_level?: number } | null;
          group_access?: { access_level?: number } | null;
        } | null;
      }>(baseUrl, accessToken, projectPath(repositoryOwner, repositoryName));
      if (!project) {
        throw new GitlabApiError("GitLab project response was empty", 500);
      }
      const access =
        project.permissions?.project_access?.access_level ??
        project.permissions?.group_access?.access_level ??
        0;
      return {
        name: project.name,
        owner: { login: repositoryOwner, username: repositoryOwner },
        html_url: project.web_url,
        private: project.visibility !== "public",
        permissions: {
          admin: access >= 40,
          push: access >= 30,
          pull: access >= 20,
        },
      };
    },

    async listUserRepos(page = 1, limit = 50) {
      const projects = await gitlabFetch<
        Array<{
          id: number;
          name: string;
          path_with_namespace: string;
          web_url: string;
          visibility: string;
        }>
      >(
        baseUrl,
        accessToken,
        `/projects?membership=true&simple=true&order_by=last_activity_at&per_page=${limit}&page=${page}`,
      );
      if (!projects) {
        throw new GitlabApiError("GitLab projects response was empty", 500);
      }
      return projects.map((project) => {
        const parts = project.path_with_namespace.split("/").filter(Boolean);
        const name = parts.pop() ?? project.name;
        const owner = parts.join("/") || name;
        return {
          id: project.id,
          name,
          full_name: project.path_with_namespace,
          owner: { login: owner, username: owner },
          private: project.visibility !== "public",
          html_url: project.web_url,
        };
      });
    },

    async createIssue(
      repositoryOwner: string,
      repositoryName: string,
      body: { title: string; body?: string | null; closed?: boolean },
    ): Promise<GitlabIssue> {
      const created = await gitlabFetch<{
        id: number;
        iid: number;
        title: string;
        description?: string | null;
        web_url: string;
        state: string;
        labels?: string[];
        author?: { username?: string; avatar_url?: string } | null;
      }>(
        baseUrl,
        accessToken,
        `${projectPath(repositoryOwner, repositoryName)}/issues`,
        {
          method: "POST",
          body: JSON.stringify({
            title: body.title,
            description: body.body ?? undefined,
            state_event: body.closed ? "close" : undefined,
          }),
        },
      );
      if (!created) {
        throw new GitlabApiError("GitLab create issue response was empty", 500);
      }
      return mapIssue(created);
    },

    async updateIssue(
      repositoryOwner: string,
      repositoryName: string,
      index: number,
      body: Record<string, unknown>,
    ): Promise<GitlabIssue> {
      const payload: Record<string, unknown> = { ...body };
      if ("body" in payload) {
        payload.description = payload.body;
        delete payload.body;
      }
      if (payload.state === "closed") {
        payload.state_event = "close";
        delete payload.state;
      } else if (payload.state === "open" || payload.state === "opened") {
        payload.state_event = "reopen";
        delete payload.state;
      }
      const updated = await gitlabFetch<{
        id: number;
        iid: number;
        title: string;
        description?: string | null;
        web_url: string;
        state: string;
        labels?: string[];
        author?: { username?: string; avatar_url?: string } | null;
      }>(
        baseUrl,
        accessToken,
        `${projectPath(repositoryOwner, repositoryName)}/issues/${index}`,
        {
          method: "PUT",
          body: JSON.stringify(payload),
        },
      );
      if (!updated) {
        throw new GitlabApiError("GitLab update issue response was empty", 500);
      }
      return mapIssue(updated);
    },

    async listIssueComments(
      repositoryOwner: string,
      repositoryName: string,
      index: number,
      page: number,
      limit: number,
    ): Promise<GitlabComment[]> {
      const notes = await gitlabFetch<
        Array<{
          id: number;
          body: string;
          created_at: string;
          system?: boolean;
          author?: { username?: string; avatar_url?: string } | null;
        }>
      >(
        baseUrl,
        accessToken,
        `${projectPath(repositoryOwner, repositoryName)}/issues/${index}/notes?per_page=${limit}&page=${page}&sort=asc`,
      );
      if (!notes) {
        throw new GitlabApiError("GitLab notes response was empty", 500);
      }
      return notes.filter((note) => !note.system).map((note) => mapNote(note));
    },

    async createIssueComment(
      repositoryOwner: string,
      repositoryName: string,
      index: number,
      body: string,
    ): Promise<GitlabComment> {
      const note = await gitlabFetch<{
        id: number;
        body: string;
        created_at: string;
        author?: { username?: string; avatar_url?: string } | null;
      }>(
        baseUrl,
        accessToken,
        `${projectPath(repositoryOwner, repositoryName)}/issues/${index}/notes`,
        {
          method: "POST",
          body: JSON.stringify({ body }),
        },
      );
      if (!note) {
        throw new GitlabApiError("GitLab create note response was empty", 500);
      }
      return mapNote(note);
    },

    async listLabels(
      repositoryOwner: string,
      repositoryName: string,
    ): Promise<GitlabLabel[]> {
      const labels = await gitlabFetch<
        Array<{ id: number; name: string; color?: string }>
      >(
        baseUrl,
        accessToken,
        `${projectPath(repositoryOwner, repositoryName)}/labels?per_page=100`,
      );
      if (!labels) {
        throw new GitlabApiError("GitLab labels response was empty", 500);
      }
      return labels;
    },

    async createLabel(
      repositoryOwner: string,
      repositoryName: string,
      name: string,
      color: string,
    ): Promise<GitlabLabel> {
      const label = await gitlabFetch<{
        id: number;
        name: string;
        color?: string;
      }>(
        baseUrl,
        accessToken,
        `${projectPath(repositoryOwner, repositoryName)}/labels`,
        {
          method: "POST",
          body: JSON.stringify({
            name,
            color: color.startsWith("#") ? color : `#${color}`,
          }),
        },
      );
      if (!label) {
        throw new GitlabApiError("GitLab create label response was empty", 500);
      }
      return label;
    },

    async addLabelsToIssue(
      repositoryOwner: string,
      repositoryName: string,
      index: number,
      labelIds: number[],
    ) {
      if (labelIds.length === 0) return;
      const labels = await this.listLabels(repositoryOwner, repositoryName);
      const names = labelIds
        .map((id) => labels.find((label) => label.id === id)?.name)
        .filter((name): name is string => Boolean(name));
      if (names.length === 0) return;
      await gitlabFetch(
        baseUrl,
        accessToken,
        `${projectPath(repositoryOwner, repositoryName)}/issues/${index}`,
        {
          method: "PUT",
          body: JSON.stringify({ add_labels: names.join(",") }),
        },
      );
    },

    async replaceIssueLabels(
      repositoryOwner: string,
      repositoryName: string,
      index: number,
      labelIds: number[],
    ) {
      const labels = await this.listLabels(repositoryOwner, repositoryName);
      const names = labelIds
        .map((id) => labels.find((label) => label.id === id)?.name)
        .filter((name): name is string => Boolean(name));
      await gitlabFetch(
        baseUrl,
        accessToken,
        `${projectPath(repositoryOwner, repositoryName)}/issues/${index}`,
        {
          method: "PUT",
          body: JSON.stringify({ labels: names.join(",") }),
        },
      );
    },

    async removeLabelFromIssue(
      repositoryOwner: string,
      repositoryName: string,
      index: number,
      labelId: number,
    ) {
      const labels = await this.listLabels(repositoryOwner, repositoryName);
      const name = labels.find((label) => label.id === labelId)?.name;
      if (!name) return;
      await gitlabFetch(
        baseUrl,
        accessToken,
        `${projectPath(repositoryOwner, repositoryName)}/issues/${index}`,
        {
          method: "PUT",
          body: JSON.stringify({ remove_labels: name }),
        },
      );
    },

    async getIssue(
      repositoryOwner: string,
      repositoryName: string,
      index: number,
    ): Promise<GitlabIssue> {
      const issue = await gitlabFetch<{
        id: number;
        iid: number;
        title: string;
        description?: string | null;
        web_url: string;
        state: string;
        labels?: string[];
        author?: { username?: string; avatar_url?: string } | null;
      }>(
        baseUrl,
        accessToken,
        `${projectPath(repositoryOwner, repositoryName)}/issues/${index}`,
      );
      if (!issue) {
        throw new GitlabApiError("GitLab issue response was empty", 500);
      }
      return mapIssue(issue);
    },

    async listIssues(
      repositoryOwner: string,
      repositoryName: string,
      page: number,
      state: "open" | "closed" | "all",
    ): Promise<GitlabIssue[]> {
      const gitlabState =
        state === "open" ? "opened" : state === "closed" ? "closed" : "all";
      const issues = await gitlabFetch<
        Array<{
          id: number;
          iid: number;
          title: string;
          description?: string | null;
          web_url: string;
          state: string;
          labels?: string[];
          author?: { username?: string; avatar_url?: string } | null;
        }>
      >(
        baseUrl,
        accessToken,
        `${projectPath(repositoryOwner, repositoryName)}/issues?state=${gitlabState}&per_page=100&page=${page}`,
      );
      if (!issues) {
        throw new GitlabApiError("GitLab issues response was empty", 500);
      }
      return issues.map(mapIssue);
    },

    async listPulls(
      repositoryOwner: string,
      repositoryName: string,
      page: number,
    ): Promise<GitlabPullRequest[]> {
      const mrs = await gitlabFetch<
        Array<{
          iid: number;
          title: string;
          description?: string | null;
          web_url: string;
          state: string;
          source_branch?: string;
          author?: { username?: string; avatar_url?: string } | null;
          merged_at?: string | null;
        }>
      >(
        baseUrl,
        accessToken,
        `${projectPath(repositoryOwner, repositoryName)}/merge_requests?state=opened&per_page=100&page=${page}`,
      );
      if (!mrs) {
        throw new GitlabApiError(
          "GitLab merge requests response was empty",
          500,
        );
      }
      return mrs.map(mapMergeRequest);
    },
  };
}

export async function verifyGitlabToken(baseUrl: string, token: string) {
  const user = await gitlabFetch<{ id: number; username: string }>(
    normalizeGitlabBaseUrl(baseUrl),
    token,
    "/user",
  );
  if (!user) {
    throw new GitlabApiError("GitLab user response was empty", 500);
  }
  return { id: user.id, login: user.username };
}
