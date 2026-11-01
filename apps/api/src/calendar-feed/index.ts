import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import { projectPermission } from "../project-rbac/require-project-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import createCalendarFeed from "./controllers/create-calendar-feed";
import getCalendarFeed from "./controllers/get-calendar-feed";
import listCalendarFeeds from "./controllers/list-calendar-feeds";
import regenerateCalendarFeed from "./controllers/regenerate-calendar-feed";
import revokeCalendarFeed from "./controllers/revoke-calendar-feed";
import { isValidTimeZone } from "./ical";
import { CALENDAR_FEED_TOKEN_PATTERN } from "./token";

const calendarFeedSchema = v.object({
  id: v.string(),
  projectId: v.string(),
  labelNames: v.array(v.string()),
  timeZone: v.string(),
  createdAt: v.date(),
});

const calendarFeedWithTokenSchema = v.object({
  ...calendarFeedSchema.entries,
  token: v.string(),
});

const createCalendarFeedBody = v.object({
  labelNames: v.optional(
    v.pipe(
      v.array(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(255))),
      v.maxLength(20),
    ),
    [],
  ),
  timeZone: v.optional(
    v.pipe(
      v.string(),
      v.maxLength(64),
      v.check(isValidTimeZone, "Invalid time zone"),
    ),
    "UTC",
  ),
});

const projectParam = v.object({ projectId: v.string() });
const feedParam = v.object({ projectId: v.string(), id: v.string() });

const jsonContent = (schema: v.GenericSchema) => ({
  "application/json": { schema: resolver(schema) },
});

// Managing feeds needs item:read in the project; each user manages only their
// own feeds. Tokens are shown once (create/regenerate) and stored hashed.
const calendarFeed = new Hono<{
  Variables: {
    userId: string;
  };
}>()
  .get(
    "/project/:projectId",
    describeRoute({
      operationId: "listCalendarFeeds",
      tags: ["Calendar Feeds"],
      description:
        "List your calendar feeds for a project. Feed secrets are never returned here.",
      responses: {
        200: {
          description: "Your calendar feeds",
          content: jsonContent(v.array(calendarFeedSchema)),
        },
      },
    }),
    validator("param", projectParam),
    workspaceAccess.fromProject("projectId"),
    projectPermission.fromParam({ item: ["read"] }),
    async (c) => {
      const { projectId } = c.req.valid("param");
      c.header("Cache-Control", "private, no-store");
      return c.json(await listCalendarFeeds(projectId, c.get("userId")));
    },
  )
  .post(
    "/project/:projectId",
    describeRoute({
      operationId: "createCalendarFeed",
      tags: ["Calendar Feeds"],
      description:
        "Create a personal iCal feed of scheduled project tasks, optionally limited to tasks with any of the given labels. The secret link is returned only once.",
      responses: {
        200: {
          description: "Calendar feed created",
          content: jsonContent(calendarFeedWithTokenSchema),
        },
      },
    }),
    validator("param", projectParam),
    validator("json", createCalendarFeedBody),
    workspaceAccess.fromProject("projectId"),
    projectPermission.fromParam({ item: ["read"] }),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const { labelNames, timeZone } = c.req.valid("json");
      c.header("Cache-Control", "private, no-store");
      return c.json(
        await createCalendarFeed({
          projectId,
          userId: c.get("userId"),
          labelNames,
          timeZone,
        }),
      );
    },
  )
  .post(
    "/project/:projectId/:id/regenerate",
    describeRoute({
      operationId: "regenerateCalendarFeed",
      tags: ["Calendar Feeds"],
      description:
        "Replace the secret link of one of your calendar feeds. The old link stops working.",
      responses: {
        200: {
          description: "Calendar feed with its new secret link",
          content: jsonContent(calendarFeedWithTokenSchema),
        },
        404: { description: "Calendar feed not found" },
      },
    }),
    validator("param", feedParam),
    workspaceAccess.fromProject("projectId"),
    projectPermission.fromParam({ item: ["read"] }),
    async (c) => {
      const { projectId, id } = c.req.valid("param");
      c.header("Cache-Control", "private, no-store");
      return c.json(
        await regenerateCalendarFeed(projectId, id, c.get("userId")),
      );
    },
  )
  .delete(
    "/project/:projectId/:id",
    describeRoute({
      operationId: "revokeCalendarFeed",
      tags: ["Calendar Feeds"],
      description: "Revoke one of your calendar feeds.",
      responses: {
        200: {
          description: "Calendar feed revoked",
          content: jsonContent(v.object({ success: v.boolean() })),
        },
        404: { description: "Calendar feed not found" },
      },
    }),
    validator("param", feedParam),
    workspaceAccess.fromProject("projectId"),
    projectPermission.fromParam({ item: ["read"] }),
    async (c) => {
      const { projectId, id } = c.req.valid("param");
      return c.json(await revokeCalendarFeed(projectId, id, c.get("userId")));
    },
  );

// Mounted before API authentication: the secret token is the credential.
export const publicCalendarFeed = new Hono().get(
  "/:token/calendar.ics",
  describeRoute({
    operationId: "getCalendarFeed",
    tags: ["Calendar Feeds"],
    description:
      "Read scheduled task titles and dates through a secret calendar feed link. Returns 404 for unknown or revoked links, or when the feed owner can no longer read the project.",
    security: [],
    responses: {
      200: {
        description: "iCalendar feed",
        content: { "text/calendar": { schema: resolver(v.string()) } },
      },
      404: { description: "Calendar feed not found" },
    },
  }),
  validator(
    "param",
    v.object({
      token: v.pipe(v.string(), v.regex(CALENDAR_FEED_TOKEN_PATTERN)),
    }),
  ),
  async (c) => {
    const body = await getCalendarFeed(c.req.valid("param").token);
    return c.body(body, 200, {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="kaneo.ics"',
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    });
  },
);

export default calendarFeed;
