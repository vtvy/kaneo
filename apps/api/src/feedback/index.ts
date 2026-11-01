import type { User } from "better-auth/types";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { createAttemptLimiter } from "../admin/system/attempt-limiter";

const limiter = createAttemptLimiter({ max: 5, windowMs: 60 * 60 * 1000 });

import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import sendFeedback from "./controllers/send-feedback";

const feedback = new Hono<{
  Variables: {
    userId: string;
    userEmail: string;
    user: User | null;
  };
}>().post(
  "/",
  describeRoute({
    operationId: "sendFeedback",
    tags: ["Feedback"],
    description: "Email product feedback to the configured inbox",
    responses: {
      200: {
        description: "Feedback email accepted",
        content: {
          "application/json": {
            schema: resolver(v.object({ ok: v.literal(true) })),
          },
        },
      },
    },
  }),
  validator(
    "json",
    v.object({
      message: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(5000)),
      pageUrl: v.optional(v.pipe(v.string(), v.maxLength(2000))),
    }),
  ),
  async (c) => {
    if (
      !c.get("userId") ||
      (c.get("user") as { isAnonymous?: boolean } | null)?.isAnonymous
    )
      throw new HTTPException(403, { message: "Sign in to send feedback" });
    const attempt = limiter.take(c.get("userId"));
    if (!attempt.allowed) {
      c.header("Retry-After", String(attempt.retryAfterSeconds));
      throw new HTTPException(429, {
        message: "Too many feedback submissions",
      });
    }
    const { message, pageUrl } = c.req.valid("json");
    const user = c.get("user");
    const result = await sendFeedback({
      message,
      pageUrl,
      senderName: user?.name ?? "",
      senderEmail: c.get("userEmail") || user?.email || "",
    });
    return c.json(result);
  },
);

export default feedback;
