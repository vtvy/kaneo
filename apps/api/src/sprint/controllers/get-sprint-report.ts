import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { sprintTable, userTable } from "../../database/schema";

// Stored completion report of a sprint. `snapshot` is null for sprints that
// are not completed or were completed before snapshots were recorded.
async function getSprintReport(id: string) {
  const [sprint] = await db
    .select({
      id: sprintTable.id,
      state: sprintTable.state,
      completedAt: sprintTable.completedAt,
      snapshot: sprintTable.completionSnapshot,
    })
    .from(sprintTable)
    .where(eq(sprintTable.id, id))
    .limit(1);

  if (!sprint) {
    throw new HTTPException(404, {
      message: "Sprint not found",
    });
  }

  const snapshot = sprint.snapshot ?? null;
  let completedByName: string | null = null;

  if (snapshot?.completedBy) {
    const [user] = await db
      .select({ name: userTable.name })
      .from(userTable)
      .where(eq(userTable.id, snapshot.completedBy))
      .limit(1);
    completedByName = user?.name ?? null;
  }

  return {
    sprintId: sprint.id,
    state: sprint.state,
    completedAt: sprint.completedAt,
    completedByName,
    snapshot,
  };
}

export default getSprintReport;
