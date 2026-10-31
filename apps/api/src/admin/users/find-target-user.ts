import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";
import type { DbOrTx } from "../audit/record-admin-action";

export async function findTargetUser(
  userId: string,
  database: DbOrTx = db,
  options: { forUpdate?: boolean } = {},
) {
  const query = database
    .select({
      id: schema.userTable.id,
      name: schema.userTable.name,
      email: schema.userTable.email,
      role: schema.userTable.role,
      banned: schema.userTable.banned,
      banExpires: schema.userTable.banExpires,
    })
    .from(schema.userTable)
    .where(eq(schema.userTable.id, userId))
    .limit(1);

  const [target] = options.forUpdate ? await query.for("update") : await query;

  if (!target) {
    throw new HTTPException(404, { message: "User not found" });
  }
  return target;
}
