import { and, eq, isNotNull, ne, sql } from "drizzle-orm";
import db from "../database";
import {
  customFieldDefinitionTable,
  customFieldValueTable,
} from "../database/schema";
import { isCustomFieldValueEmpty } from "./validate-value";

// New tasks start with each field's default, matching what fields created
// with a default backfill onto existing tasks.
export async function applyDefaultCustomFieldValues(
  taskId: string,
  projectId: string,
) {
  const fields = await db
    .select({
      id: customFieldDefinitionTable.id,
      type: customFieldDefinitionTable.type,
      defaultValue: customFieldDefinitionTable.defaultValue,
    })
    .from(customFieldDefinitionTable)
    .where(
      and(
        eq(customFieldDefinitionTable.projectId, projectId),
        isNotNull(customFieldDefinitionTable.defaultValue),
        ne(customFieldDefinitionTable.defaultValue, ""),
      ),
    );

  const defaults = fields.filter(
    (field) =>
      field.defaultValue !== null &&
      !isCustomFieldValueEmpty(field.defaultValue, field.type),
  );
  if (defaults.length === 0) return;

  await db
    .insert(customFieldValueTable)
    .values(
      defaults.map((field) => ({
        taskId,
        fieldId: field.id,
        value: field.defaultValue,
      })),
    )
    .onConflictDoNothing();
}

// Copies the values of fields that belong to the source task's project.
export async function copyCustomFieldValues(
  sourceTaskId: string,
  targetTaskId: string,
  projectId: string,
) {
  const values = await db
    .select({
      fieldId: customFieldValueTable.fieldId,
      value: customFieldValueTable.value,
    })
    .from(customFieldValueTable)
    .innerJoin(
      customFieldDefinitionTable,
      eq(customFieldValueTable.fieldId, customFieldDefinitionTable.id),
    )
    .where(
      and(
        eq(customFieldValueTable.taskId, sourceTaskId),
        eq(customFieldDefinitionTable.projectId, projectId),
      ),
    );

  if (values.length === 0) return;

  await db
    .insert(customFieldValueTable)
    .values(
      values.map(({ fieldId, value }) => ({
        taskId: targetTaskId,
        fieldId,
        value,
      })),
    )
    .onConflictDoUpdate({
      target: [customFieldValueTable.taskId, customFieldValueTable.fieldId],
      set: { value: sql`excluded.value` },
    });
}
