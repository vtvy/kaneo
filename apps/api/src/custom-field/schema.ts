import * as v from "valibot";

export const customFieldTypeSchema = v.picklist([
  "text",
  "number",
  "date",
  "dropdown",
  "boolean",
  "multiselect",
]);

export const createCustomFieldBody = v.object({
  projectId: v.string(),
  name: v.pipe(v.string(), v.maxLength(200)),
  type: customFieldTypeSchema,
  required: v.optional(v.boolean(), false),
  defaultValue: v.optional(v.string()),
  options: v.optional(v.array(v.string())),
});

export const updateCustomFieldBody = v.object({
  name: v.optional(v.pipe(v.string(), v.maxLength(200))),
  type: v.optional(customFieldTypeSchema),
  required: v.optional(v.boolean()),
  defaultValue: v.optional(v.nullable(v.string())),
  options: v.optional(v.array(v.string())),
  hiddenOptions: v.optional(v.array(v.string())),
});

export const reorderCustomFieldsBody = v.object({
  fields: v.array(v.object({ id: v.string(), position: v.number() })),
});

export const setCustomFieldValueBody = v.object({
  taskId: v.string(),
  fieldId: v.string(),
  value: v.string(),
});

export const customFieldDefinitionSchema = v.object({
  id: v.string(),
  projectId: v.string(),
  name: v.string(),
  type: v.string(),
  required: v.boolean(),
  defaultValue: v.nullable(v.string()),
  options: v.nullable(v.unknown()),
  hiddenOptions: v.array(v.string()),
  position: v.number(),
  createdAt: v.date(),
  updatedAt: v.date(),
});

export const customFieldValueSchema = v.object({
  id: v.string(),
  taskId: v.string(),
  fieldId: v.string(),
  value: v.nullable(v.string()),
  fieldName: v.string(),
  fieldPosition: v.number(),
  fieldType: v.string(),
  fieldOptions: v.nullable(v.unknown()),
});

export const customFieldFilterValuesSchema = v.object({
  fieldId: v.string(),
  fieldName: v.string(),
  fieldType: v.string(),
  values: v.array(v.string()),
});

export const setCustomFieldValueResponseSchema = v.object({
  id: v.string(),
  taskId: v.string(),
  fieldId: v.string(),
  value: v.nullable(v.string()),
});
