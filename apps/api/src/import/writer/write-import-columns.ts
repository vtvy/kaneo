import { createId } from "@paralleldrive/cuid2";
import type db from "../../database";
import { columnTable } from "../../database/schema";
import { DEFAULT_PROJECT_COLUMNS } from "../../project/controllers/create-project";
import { chunk } from "./chunk";
import type { ImportColumnPlan } from "./plan-import-columns";
import type { BoardColumn } from "./plan-import-tasks";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type ImportBoard = {
  byKey: Map<string, BoardColumn>;
  fallback: BoardColumn | null;
  count: number;
};

export async function writeImportColumns(
  tx: Transaction,
  projectId: string,
  plan: ImportColumnPlan,
): Promise<ImportBoard> {
  // A source without columns gets the columns a new project starts with;
  // its tasks land in the first one.
  const columns =
    plan.columns.length > 0
      ? plan.columns
      : DEFAULT_PROJECT_COLUMNS.map((column) => ({ ...column, key: "" }));

  const planned = columns.map((column) => ({
    key: column.key,
    row: {
      id: createId(),
      projectId,
      name: column.name,
      slug: column.slug,
      position: column.position,
      isFinal: column.isFinal,
    },
  }));
  for (const batch of chunk(planned.map(({ row }) => row))) {
    await tx.insert(columnTable).values(batch);
  }

  const byKey = new Map(
    plan.columns.length > 0
      ? planned.map(({ key, row }) => [key, { id: row.id, slug: row.slug }])
      : [],
  );
  const first = planned[0]?.row;
  return {
    byKey,
    fallback: first ? { id: first.id, slug: first.slug } : null,
    count: planned.length,
  };
}
