import { and, eq, isNotNull, ne, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import {
  customFieldDefinitionTable,
  customFieldValueTable,
} from "../database/schema";
import { assertCustomFieldValue } from "./assert-field-value";
import { isCustomFieldValueEmpty } from "./validate-value";

export type CustomFieldValueInput = { fieldId: string; value: string };

// Validates values sent with a new task. Each field must belong to the
// project and the value must fit its type and visible options. Once a client
// sends values, required fields without a default must be among them.
export async function resolveCreateCustomFieldValues(
  projectId: string,
  inputs: CustomFieldValueInput[],
): Promise<CustomFieldValueInput[]> {
  const fields = await db
    .select()
    .from(customFieldDefinitionTable)
    .where(eq(customFieldDefinitionTable.projectId, projectId));
  const fieldsById = new Map(fields.map((field) => [field.id, field]));

  // The last value sent for a field wins.
  const byField = new Map<string, string>();
  for (const input of inputs) byField.set(input.fieldId, input.value);

  const resolved: CustomFieldValueInput[] = [];
  for (const [fieldId, value] of byField) {
    const field = fieldsById.get(fieldId);
    if (!field) {
      throw new HTTPException(400, {
        message: `Custom field "${fieldId}" does not belong to this project`,
      });
    }
    try {
      resolved.push({
        fieldId,
        value: assertCustomFieldValue(field, value, null),
      });
    } catch (error) {
      if (!(error instanceof HTTPException)) throw error;
      throw new HTTPException(400, {
        message: `Custom field "${field.name}": ${error.message}`,
      });
    }
  }

  for (const field of fields) {
    if (!field.required || byField.has(field.id)) continue;
    const hasDefault =
      field.defaultValue != null &&
      !isCustomFieldValueEmpty(field.defaultValue, field.type);
    if (!hasDefault) {
      throw new HTTPException(400, {
        message: `Custom field "${field.name}" is required to create a task`,
      });
    }
  }

  return resolved;
}

export async function insertCustomFieldValues(
  taskId: string,
  values: CustomFieldValueInput[],
) {
  if (values.length === 0) return;
  await db
    .insert(customFieldValueTable)
    .values(values.map(({ fieldId, value }) => ({ taskId, fieldId, value })))
    .onConflictDoNothing();
}

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
