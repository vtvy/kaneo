import { SourceHttpError } from "../http.js";
import type { ImportedProject, ReadProjectOptions } from "../types.js";
import type { JiraComment, JiraProject } from "./api-types.js";
import { readBoardColumns } from "./board.js";
import type { JiraClient } from "./client.js";
import { mapJiraProject } from "./project.js";
import { readComments } from "./read-comments.js";
import { searchProjectIssues } from "./search.js";
import { findStoryPointsField } from "./story-points.js";

export async function readJiraProject(
  client: JiraClient,
  baseUrl: string,
  projectKey: string,
  options: ReadProjectOptions,
): Promise<ImportedProject> {
  const { onProgress } = options;

  onProgress?.("Reading project and board");
  const project = await readProjectDetails(client, projectKey);
  const statusGroups = await client.projectStatuses(project.key);
  const board = await readBoardColumns(client, project.key);
  const pointsField = await readStoryPointsField(client, options.signal);

  onProgress?.("Reading issues");
  const issues = await searchProjectIssues(client, project.key, {
    includeComments: options.includeComments,
    extraFields: pointsField ? [pointsField] : [],
    onPage: (loaded) => onProgress?.(`Reading issues (${loaded} so far)`),
  });

  let comments = new Map<string, JiraComment[]>();
  if (options.includeComments && issues.length > 0) {
    comments = await readComments(client, issues, onProgress);
  }

  return mapJiraProject({
    baseUrl,
    project,
    statusGroups,
    boardColumns: board.columns,
    boardUnavailable: board.unavailable,
    issues,
    comments,
    pointsField,
  });
}

// Story points are optional: a site that hides its field list still imports.
async function readStoryPointsField(
  client: JiraClient,
  signal: AbortSignal | undefined,
): Promise<string | null> {
  try {
    return findStoryPointsField(await client.fields());
  } catch (error) {
    if (signal?.aborted) throw error;
    return null;
  }
}

async function readProjectDetails(
  client: JiraClient,
  projectKey: string,
): Promise<JiraProject> {
  try {
    return await client.getProject(projectKey);
  } catch (error) {
    if (error instanceof SourceHttpError && error.status === 404) {
      throw new Error(
        `Jira could not find the project "${projectKey}", or this account cannot browse it.`,
      );
    }
    throw error;
  }
}
