import { client } from "@kaneo/libs";
import { getApiUrl } from "../get-api-url";

const endpoint = client["calendar-feed"].project[":projectId"];

async function ensureOk(response: Response) {
  if (!response.ok) throw new Error(await response.text());
}

export async function getCalendarFeeds(projectId: string) {
  const response = await endpoint.$get({ param: { projectId } });
  await ensureOk(response);
  return response.json();
}

export async function createCalendarFeed({
  projectId,
  labelNames,
  timeZone,
}: {
  projectId: string;
  labelNames: string[];
  timeZone: string;
}) {
  const response = await endpoint.$post({
    param: { projectId },
    json: { labelNames, timeZone },
  });
  await ensureOk(response);
  return response.json();
}

export async function regenerateCalendarFeed({
  projectId,
  id,
}: {
  projectId: string;
  id: string;
}) {
  const response = await endpoint[":id"].regenerate.$post({
    param: { projectId, id },
  });
  await ensureOk(response);
  return response.json();
}

export async function revokeCalendarFeed({
  projectId,
  id,
}: {
  projectId: string;
  id: string;
}) {
  const response = await endpoint[":id"].$delete({ param: { projectId, id } });
  await ensureOk(response);
  return response.json();
}

export function getCalendarFeedUrl(token: string) {
  return new URL(
    getApiUrl(`/calendar-feed/${encodeURIComponent(token)}/calendar.ics`),
    window.location.origin,
  ).href;
}
