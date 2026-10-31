import { sql } from "drizzle-orm";
import { columnTable, taskTable } from "../database/schema";

// A task is completed while its status is a final column of its project.
export const taskIsCompleted = sql<boolean>`exists (
  select 1 from ${columnTable}
  where ${columnTable.projectId} = ${taskTable.projectId}
    and ${columnTable.slug} = ${taskTable.status}
    and ${columnTable.isFinal} = true
)`;
