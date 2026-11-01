import { SourceHttpError } from "../http.js";
import type { JiraIssue } from "./api-types.js";
import {
  type JiraClient,
  SEARCH_PAGE_SIZE,
  type SearchQuery,
} from "./client.js";

export const ISSUE_FIELDS = [
  "summary",
  "description",
  "status",
  "priority",
  "assignee",
  "labels",
  "duedate",
  "created",
  "parent",
  "issuelinks",
  "attachment",
];

export const MAX_IMPORT_ISSUES = 20_000;

export const TOO_MANY_ISSUES_MESSAGE = `This Jira project has more than ${MAX_IMPORT_ISSUES.toLocaleString("en-US")} issues, more than Kaneo imports at once.`;

function assertWithinLimit(issues: readonly JiraIssue[]) {
  if (issues.length > MAX_IMPORT_ISSUES)
    throw new Error(TOO_MANY_ISSUES_MESSAGE);
}

export const RANK_ORDER = "ORDER BY Rank ASC";
export const CREATED_ORDER = "ORDER BY created ASC";

export type SearchOptions = {
  includeComments: boolean;
  extraFields?: readonly string[];
  onPage?: (loaded: number) => void;
};

export async function searchProjectIssues(
  client: JiraClient,
  projectKey: string,
  options: SearchOptions,
): Promise<JiraIssue[]> {
  const scope = `project = ${quoteJql(projectKey)}`;
  const fields = [
    ...ISSUE_FIELDS,
    ...(options.extraFields ?? []),
    ...(options.includeComments ? ["comment"] : []),
  ];
  let loaded = 0;
  const onPage = (count: number) => {
    loaded = count;
    options.onPage?.(count);
  };

  try {
    return await searchAll(
      client,
      { jql: `${scope} ${RANK_ORDER}`, fields },
      onPage,
    );
  } catch (error) {
    if (
      !(error instanceof SourceHttpError) ||
      error.status !== 400 ||
      loaded > 0
    ) {
      throw error;
    }
  }
  return searchAll(
    client,
    { jql: `${scope} ${CREATED_ORDER}`, fields },
    onPage,
  );
}

export function quoteJql(value: string): string {
  return `"${value.replace(/["\\]/g, "\\$&")}"`;
}

function searchAll(
  client: JiraClient,
  query: SearchQuery,
  onPage: (loaded: number) => void,
): Promise<JiraIssue[]> {
  return client.cloud
    ? searchByToken(client, query, onPage)
    : searchByOffset(client, query, onPage);
}

async function searchByToken(
  client: JiraClient,
  query: SearchQuery,
  onPage: (loaded: number) => void,
): Promise<JiraIssue[]> {
  const issues: JiraIssue[] = [];
  const seenTokens = new Set<string>();
  let token: string | undefined;
  for (;;) {
    const page = await client.searchCloud(query, token);
    issues.push(...(page?.issues ?? []));
    assertWithinLimit(issues);
    onPage(issues.length);
    const next = page?.nextPageToken ?? undefined;
    if (!next || page?.isLast === true || seenTokens.has(next)) return issues;
    seenTokens.add(next);
    token = next;
  }
}

async function searchByOffset(
  client: JiraClient,
  query: SearchQuery,
  onPage: (loaded: number) => void,
): Promise<JiraIssue[]> {
  const issues: JiraIssue[] = [];
  for (;;) {
    const page = await client.searchServer(query, issues.length);
    const batch = page?.issues ?? [];
    issues.push(...batch);
    assertWithinLimit(issues);
    onPage(issues.length);
    const total = page?.total;
    const done =
      typeof total === "number"
        ? issues.length >= total
        : batch.length < SEARCH_PAGE_SIZE;
    if (batch.length === 0 || done) return issues;
  }
}
