import { and, eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import db from "../../database";
import {
  customFieldDefinitionTable,
  customFieldValueTable,
  taskTable,
} from "../../database/schema";
import { assertCustomFieldValue } from "../assert-field-value";
import { isChoiceType } from "../choice-options";

async function setCustomFieldValue(
  taskId: string,
  fieldId: string,
  value: string,
) {
  const [task] = await db
    .select({
      projectId: taskTable.projectId,
    })
    .from(taskTable)
    .where(eq(taskTable.id, taskId))
    .limit(1);

  if (!task) {
    throw new HTTPException(404, {
      message: "Task not found",
    });
  }

  const [field] = await db
    .select()
    .from(customFieldDefinitionTable)
    .where(eq(customFieldDefinitionTable.id, fieldId))
    .limit(1);

  if (!field || field.projectId !== task.projectId) {
    throw new HTTPException(404, {
      message: "Custom field not found",
    });
  }

  // Hidden options a task already holds stay allowed, so choice fields need
  // the stored value.
  let current: string | null = null;
  if (isChoiceType(field.type)) {
    const [row] = await db
      .select({ value: customFieldValueTable.value })
      .from(customFieldValueTable)
      .where(
        and(
          eq(customFieldValueTable.taskId, taskId),
          eq(customFieldValueTable.fieldId, fieldId),
        ),
      )
      .limit(1);
    current = row?.value ?? null;
  }

  const normalizedValue = assertCustomFieldValue(field, value, current);

  const [result] = await db
    .insert(customFieldValueTable)
    .values({
      taskId,
      fieldId,
      value: normalizedValue,
    })
    .onConflictDoUpdate({
      target: [customFieldValueTable.taskId, customFieldValueTable.fieldId],
      set: {
        value: sql`excluded.value`,
      },
    })
    .returning();

  return result;
}

export default setCustomFieldValue;
