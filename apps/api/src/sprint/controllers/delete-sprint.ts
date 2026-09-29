import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { sprintTable } from "../../database/schema";

async function deleteSprint(id: string) {
  const existingSprint = await db.query.sprintTable.findFirst({
    where: eq(sprintTable.id, id),
  });

  if (!existingSprint) {
    throw new HTTPException(404, {
      message: "Sprint not found",
    });
  }

  const [deletedSprint] = await db
    .delete(sprintTable)
    .where(eq(sprintTable.id, id))
    .returning();

  if (!deletedSprint) {
    throw new HTTPException(404, {
      message: "Sprint not found",
    });
  }

  return deletedSprint;
}

export default deleteSprint;
