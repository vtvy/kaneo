import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { getInstanceSettings } from "./get-instance-settings";

const READ_OR_REMOVE = new Set(["GET", "HEAD", "OPTIONS", "DELETE"]);

/**
 * While an administrator has turned a provider off, projects can still see and
 * remove an existing connection, but can't create or change one.
 */
export function requireIntegrationEnabled(type: string) {
  return async (c: Context, next: Next) => {
    if (
      !READ_OR_REMOVE.has(c.req.method) &&
      (await getInstanceSettings()).disabledIntegrations.includes(type)
    ) {
      throw new HTTPException(403, {
        message: "An administrator turned this integration off.",
      });
    }
    return next();
  };
}
