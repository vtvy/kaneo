import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { sprintTable } from "../../database/schema";
import { sprintColumns } from "../sprint-columns";
import { getSprintTotals } from "./get-sprint-totals";

async function getSprint(id: string) {
  const [sprint] = await db
    .select(sprintColumns)
    .from(sprintTable)
    .where(eq(sprintTable.id, id))
    .limit(1);

  if (!sprint) {
    throw new HTTPException(404, {
      message: "Sprint not found",
    });
  }

  const totals = await getSprintTotals(id);

  return {
    ...sprint,
    ...totals,
  };
}

export default getSprint;
