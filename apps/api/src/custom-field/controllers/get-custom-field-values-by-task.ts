import { and, eq } from "drizzle-orm";
import db from "../../database";
import {
  customFieldDefinitionTable,
  customFieldValueTable,
  taskTable,
} from "../../database/schema";

async function getCustomFieldValuesByTask(taskId: string) {
  // Only fields of the task's current project; values left behind by a move
  // to another project stay hidden.
  return db
    .select({
      id: customFieldValueTable.id,
      taskId: customFieldValueTable.taskId,
      fieldId: customFieldValueTable.fieldId,
      value: customFieldValueTable.value,
      fieldName: customFieldDefinitionTable.name,
      fieldPosition: customFieldDefinitionTable.position,
      fieldType: customFieldDefinitionTable.type,
      fieldOptions: customFieldDefinitionTable.options,
    })
    .from(customFieldValueTable)
    .innerJoin(taskTable, eq(customFieldValueTable.taskId, taskTable.id))
    .innerJoin(
      customFieldDefinitionTable,
      and(
        eq(customFieldValueTable.fieldId, customFieldDefinitionTable.id),
        eq(customFieldDefinitionTable.projectId, taskTable.projectId),
      ),
    )
    .where(eq(customFieldValueTable.taskId, taskId));
}

export default getCustomFieldValuesByTask;
