import { eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../database";
import { isBanActive } from "./users/is-ban-active";

/**
 * Re-checks instance admin status against the database on every request, so
 * a stale cached session role never grants access. API keys are refused:
 * a leaked key must not be able to administer the instance.
 */
export const requireInstanceAdmin = createMiddleware<{
  Variables: { userId: string; apiKey?: { id: string } };
}>(async (c, next) => {
  if (c.get("apiKey")) {
    throw new HTTPException(403, {
      message: "API keys cannot be used for instance administration",
    });
  }

  const userId = c.get("userId");
  if (!userId) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  const [user] = await db
    .select({
      role: schema.userTable.role,
      banned: schema.userTable.banned,
      banExpires: schema.userTable.banExpires,
    })
    .from(schema.userTable)
    .where(eq(schema.userTable.id, userId))
    .limit(1);

  if (user?.role !== "admin" || isBanActive(user)) {
    throw new HTTPException(403, {
      message: "Instance administrator access required",
    });
  }

  await next();
});
