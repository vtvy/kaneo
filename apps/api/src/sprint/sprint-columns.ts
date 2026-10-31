import { getTableColumns } from "drizzle-orm";
import { sprintTable } from "../database/schema";

// Sprint columns returned by the regular sprint endpoints. The completion
// snapshot can hold up to a thousand task entries, so it is only served by
// GET /sprint/:id/report.
const { completionSnapshot: _completionSnapshot, ...sprintColumns } =
  getTableColumns(sprintTable);

export { sprintColumns };
