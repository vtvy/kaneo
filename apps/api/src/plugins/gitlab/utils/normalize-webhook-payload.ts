/**
 * Convert GitLab webhook JSON into the Gitea/GitHub-shaped payloads our
 * reused handlers expect (repository + issue/pull_request/comment).
 */
export function normalizeGitlabWebhookPayload(
  eventHeader: string,
  payload: Record<string, unknown>,
): { event: string; payload: Record<string, unknown> } {
  const objectKind =
    typeof payload.object_kind === "string" ? payload.object_kind : eventHeader;

  const project = asRecord(payload.project);
  const attrs = asRecord(payload.object_attributes);
  const user = asRecord(payload.user);

  // Confidential issues and notes stay in GitLab: mirroring them into a
  // project whose members may not see them in GitLab would leak them.
  if (
    payload.event_type === "confidential_issue" ||
    payload.event_type === "confidential_note" ||
    attrs?.confidential === true ||
    asRecord(payload.issue)?.confidential === true
  ) {
    return { event: "ignored", payload: {} };
  }

  const pathWithNamespace =
    typeof project?.path_with_namespace === "string"
      ? project.path_with_namespace
      : "";
  const pathParts = pathWithNamespace.split("/").filter(Boolean);
  // Prefer GitLab path (slug), not display name — matching uses repositoryName.
  const repositoryPath = pathParts[pathParts.length - 1];
  const repository = project
    ? {
        full_name: pathWithNamespace,
        html_url:
          typeof project.web_url === "string" ? project.web_url : undefined,
        name:
          repositoryPath ||
          (typeof project.path === "string" ? project.path : undefined) ||
          (typeof project.name === "string" ? project.name : undefined),
        owner: {
          login: splitOwner(pathWithNamespace),
        },
      }
    : undefined;

  if (objectKind === "push") {
    return {
      event: "push",
      payload: {
        ...payload,
        ref: payload.ref,
        repository,
      },
    };
  }

  if (objectKind === "issue") {
    const action = typeof attrs?.action === "string" ? attrs.action : undefined;
    const labels = Array.isArray(payload.labels)
      ? payload.labels.map((label) => {
          const item = asRecord(label);
          return {
            id: typeof item?.id === "number" ? item.id : 0,
            name:
              typeof item?.title === "string"
                ? item.title
                : typeof item?.name === "string"
                  ? item.name
                  : "",
            color: typeof item?.color === "string" ? item.color : undefined,
          };
        })
      : [];

    const issue = attrs
      ? {
          id: attrs.id,
          number: attrs.iid,
          title: attrs.title,
          body: attrs.description ?? null,
          html_url: attrs.url,
          state: attrs.state === "opened" ? "open" : attrs.state,
          labels,
          user: user
            ? {
                login: user.username,
                username: user.username,
                avatar_url: user.avatar_url,
              }
            : null,
        }
      : undefined;

    return {
      event: "issues",
      payload: {
        action: mapIssueAction(action),
        issue,
        repository,
        label: labels[0],
      },
    };
  }

  if (objectKind === "note" || objectKind === "comment") {
    const noteableType =
      typeof attrs?.noteable_type === "string" ? attrs.noteable_type : "";
    if (noteableType !== "Issue") {
      return { event: objectKind, payload };
    }
    const issue = asRecord(payload.issue);
    return {
      event: "issue_comment",
      payload: {
        action: "created",
        comment: attrs
          ? {
              id: attrs.id,
              body: attrs.note,
              html_url: attrs.url,
              user: user
                ? {
                    login: user.username,
                    username: user.username,
                    avatar_url: user.avatar_url,
                  }
                : null,
              created_at: attrs.created_at,
            }
          : undefined,
        issue: issue
          ? {
              id: issue.id,
              number: issue.iid,
              title: issue.title,
              body: issue.description ?? null,
              html_url: issue.url ?? issue.web_url,
              state: issue.state === "opened" ? "open" : issue.state,
            }
          : undefined,
        repository,
      },
    };
  }

  if (objectKind === "merge_request") {
    const action = typeof attrs?.action === "string" ? attrs.action : undefined;
    const pullRequest = attrs
      ? {
          number: attrs.iid,
          title: attrs.title,
          body: attrs.description ?? null,
          html_url: attrs.url,
          state:
            attrs.state === "merged"
              ? "closed"
              : attrs.state === "opened"
                ? "open"
                : attrs.state,
          merged: attrs.state === "merged" || Boolean(attrs.merged_at),
          merged_at: attrs.merged_at ?? null,
          head: { ref: attrs.source_branch },
          user: user
            ? {
                login: user.username,
                username: user.username,
                avatar_url: user.avatar_url,
              }
            : null,
        }
      : undefined;

    return {
      event: "pull_request",
      payload: {
        action: mapMergeRequestAction(action),
        pull_request: pullRequest,
        repository,
      },
    };
  }

  return { event: objectKind, payload };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function splitOwner(pathWithNamespace: string) {
  const parts = pathWithNamespace.split("/").filter(Boolean);
  parts.pop();
  return parts.join("/") || pathWithNamespace;
}

function mapIssueAction(action: string | undefined) {
  if (action === "open") return "opened";
  if (action === "close") return "closed";
  if (action === "reopen") return "reopened";
  if (action === "update") return "edited";
  return action;
}

function mapMergeRequestAction(action: string | undefined) {
  if (action === "open") return "opened";
  if (action === "close") return "closed";
  if (action === "reopen") return "reopened";
  if (action === "merge") return "closed";
  return action;
}
