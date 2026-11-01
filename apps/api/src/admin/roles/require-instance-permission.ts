import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import {
  getInstanceAccess,
  hasInstancePrivileges,
} from "./get-instance-access";
import type { InstancePermission } from "./permissions";

export function requireInstancePermission(
  required?:
    | InstancePermission
    | ((method: string, path: string) => InstancePermission),
) {
  return createMiddleware<{
    Variables: { userId: string; apiKey?: { id: string } };
  }>(async (c, next) => {
    if (c.get("apiKey"))
      throw new HTTPException(403, {
        message: "API keys cannot be used for instance administration",
      });
    const userId = c.get("userId");
    if (!userId) throw new HTTPException(401, { message: "Unauthorized" });
    const access = await getInstanceAccess(userId);
    const permission =
      typeof required === "function"
        ? required(c.req.method, c.req.path)
        : required;
    if (
      permission
        ? !access.permissions.includes(permission)
        : access.permissions.length === 0
    )
      throw new HTTPException(403, { message: "Instance permission required" });
    const targetId = c.req.path.match(/\/admin\/users\/([^/]+)/)?.[1];
    if (
      !access.isAdmin &&
      targetId &&
      (await hasInstancePrivileges(decodeURIComponent(targetId)))
    ) {
      throw new HTTPException(403, {
        message: "Only built-in administrators can manage privileged accounts",
      });
    }
    await next();
  });
}
