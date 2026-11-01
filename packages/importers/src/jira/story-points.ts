import type { JiraField, JiraIssue } from "./api-types.js";

// Jira keeps story points in a custom field whose id differs per site, so it
// is found by name: "Story Points" (classic) or "Story point estimate"
// (team-managed).
const STORY_POINT_NAMES = new Set(["story points", "story point estimate"]);
const MAX_POINTS = 1000;

export function findStoryPointsField(
  fields: readonly JiraField[] | null | undefined,
): string | null {
  const field = (fields ?? []).find(
    (candidate) =>
      typeof candidate?.id === "string" &&
      STORY_POINT_NAMES.has(candidate.name?.trim().toLowerCase() ?? "") &&
      (candidate.schema?.type ?? "number") === "number",
  );
  return field?.id ?? null;
}

export function issuePoints(
  issue: JiraIssue,
  field: string | null | undefined,
): number | undefined {
  if (!field) return undefined;
  const value = (issue.fields as Record<string, unknown> | null | undefined)?.[
    field
  ];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return undefined;
  }
  return Math.min(MAX_POINTS, Math.round(value));
}
