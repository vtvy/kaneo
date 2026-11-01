import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { describeRoute, resolver } from "hono-openapi";
import * as v from "valibot";
import db, { schema } from "../database";

const user = new Hono<{ Variables: { userId: string } }>().get(
  "/me",
  describeRoute({
    operationId: "getCurrentUser",
    tags: ["Users"],
    description: "Get the authenticated user's public profile",
    responses: {
      200: {
        description: "Current user",
        content: {
          "application/json": {
            schema: resolver(
              v.object({
                id: v.string(),
                name: v.string(),
                email: v.string(),
                image: v.nullable(v.string()),
                role: v.nullable(v.string()),
              }),
            ),
          },
        },
      },
    },
  }),
  async (c) => {
    const [profile] = await db
      .select({
        id: schema.userTable.id,
        name: schema.userTable.name,
        email: schema.userTable.email,
        image: schema.userTable.image,
        role: schema.userTable.role,
      })
      .from(schema.userTable)
      .where(eq(schema.userTable.id, c.get("userId")))
      .limit(1);
    if (!profile) throw new HTTPException(401, { message: "Unauthorized" });
    return c.json(profile);
  },
);

export default user;
