import { createId } from "@paralleldrive/cuid2";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import type {
  CaseSnapshot,
  Outcome,
  StepResult,
  TestStep,
} from "../test-plan/model";
import { projectTable, sprintTable, taskTable, userTable } from "./schema";

export const testPlanTable = pgTable(
  "test_plan",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    projectId: text("project_id")
      .notNull()
      .references(() => projectTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    sprintId: text("sprint_id").references(() => sprintTable.id, {
      onDelete: "set null",
    }),
    release: text("release").notNull().default(""),
    state: text("state").notNull().default("active"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("test_plan_project_idx").on(t.projectId)],
);

export const testSuiteTable = pgTable(
  "test_suite",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    planId: text("plan_id")
      .notNull()
      .references(() => testPlanTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
  },
  (t) => [index("test_suite_plan_idx").on(t.planId)],
);

export const testCaseTable = pgTable(
  "test_case",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    projectId: text("project_id")
      .notNull()
      .references(() => projectTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    preconditions: text("preconditions").notNull().default(""),
    steps: jsonb("steps").$type<TestStep[]>().notNull(),
    requirementId: text("requirement_id").references(() => taskTable.id, {
      onDelete: "set null",
    }),
    state: text("state").notNull().default("ready"),
    revision: integer("revision").notNull().default(1),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("test_case_project_idx").on(t.projectId),
    index("test_case_requirement_idx").on(t.requirementId),
  ],
);

export const testSuiteCaseTable = pgTable(
  "test_suite_case",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    suiteId: text("suite_id")
      .notNull()
      .references(() => testSuiteTable.id, { onDelete: "cascade" }),
    caseId: text("case_id")
      .notNull()
      .references(() => testCaseTable.id, { onDelete: "cascade" }),
  },
  (t) => [
    unique("test_suite_case_unique").on(t.suiteId, t.caseId),
    index("test_suite_case_case_idx").on(t.caseId),
  ],
);

export const testRunTable = pgTable(
  "test_run",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    planId: text("plan_id")
      .notNull()
      .references(() => testPlanTable.id, { onDelete: "cascade" }),
    suiteId: text("suite_id").references(() => testSuiteTable.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    testerId: text("tester_id").references(() => userTable.id, {
      onDelete: "set null",
    }),
    createdBy: text("created_by").references(() => userTable.id, {
      onDelete: "set null",
    }),
    environment: text("environment").notNull().default(""),
    build: text("build").notNull().default(""),
    clientKey: text("client_key").notNull(),
    state: text("state").notNull().default("in_progress"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { mode: "date" }),
  },
  (t) => [
    index("test_run_plan_idx").on(t.planId),
    unique("test_run_plan_client_unique").on(t.planId, t.clientKey),
  ],
);

export const testResultTable = pgTable(
  "test_result",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    runId: text("run_id")
      .notNull()
      .references(() => testRunTable.id, { onDelete: "cascade" }),
    caseId: text("case_id").references(() => testCaseTable.id, {
      onDelete: "set null",
    }),
    snapshot: jsonb("snapshot").$type<CaseSnapshot>().notNull(),
    outcome: text("outcome").$type<Outcome>().notNull().default("not_run"),
    steps: jsonb("steps").$type<StepResult[]>().notNull(),
    actual: text("actual").notNull().default(""),
    evidence: jsonb("evidence").$type<string[]>().notNull().default([]),
    bugId: text("bug_id").references(() => taskTable.id, {
      onDelete: "set null",
    }),
    updatedBy: text("updated_by").references(() => userTable.id, {
      onDelete: "set null",
    }),
    version: integer("version").notNull().default(1),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("test_result_run_idx").on(t.runId),
    index("test_result_bug_idx").on(t.bugId),
    unique("test_result_run_case_unique").on(t.runId, t.caseId),
  ],
);
