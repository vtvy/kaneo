import { IMPORT_SOURCE_IDS, type ImportSourceId } from "@kaneo/importers";
import * as v from "valibot";
import {
  IMPORT_RUN_PROJECT_STATUSES,
  IMPORT_RUN_STATUSES,
  type ImportRunProject,
  type ImportRunStatus,
} from "./import-run-project";

export const importSourceProjectSchema = v.object({
  id: v.string(),
  name: v.string(),
  detail: v.optional(v.string()),
});

export const importSourceProjectListSchema = v.object({
  projects: v.array(importSourceProjectSchema),
});

const importCountsSchema = v.object({
  columns: v.number(),
  tasks: v.number(),
  labels: v.number(),
  comments: v.number(),
  assignees: v.number(),
  relations: v.number(),
});

export const importRunProjectSchema = v.object({
  sourceId: v.string(),
  name: v.string(),
  status: v.picklist(IMPORT_RUN_PROJECT_STATUSES),
  projectId: v.nullable(v.string()),
  projectSlug: v.nullable(v.string()),
  counts: importCountsSchema,
  warnings: v.array(v.string()),
  error: v.nullable(v.string()),
});

export const importRunSchema = v.object({
  id: v.string(),
  workspaceId: v.string(),
  source: v.picklist(IMPORT_SOURCE_IDS),
  status: v.picklist(IMPORT_RUN_STATUSES),
  includeComments: v.boolean(),
  message: v.nullable(v.string()),
  error: v.nullable(v.string()),
  projects: v.array(importRunProjectSchema),
  createdAt: v.date(),
  finishedAt: v.nullable(v.date()),
});

export const importRunEnvelopeSchema = v.object({ run: importRunSchema });

export const importRunListSchema = v.object({
  runs: v.array(importRunSchema),
});

export type ImportRunResponse = {
  id: string;
  workspaceId: string;
  source: ImportSourceId;
  status: ImportRunStatus;
  includeComments: boolean;
  message: string | null;
  error: string | null;
  projects: ImportRunProject[];
  createdAt: Date;
  finishedAt: Date | null;
};
