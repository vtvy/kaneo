import { createId } from "@paralleldrive/cuid2";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { userTable } from "./schema";

export const instanceRoleTable = pgTable("instance_role", {
  id: text("id").primaryKey().$defaultFn(createId),
  name: text("name").notNull().unique(),
  permissions: jsonb("permissions").$type<string[]>().notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const instanceRoleAssignmentTable = pgTable(
  "instance_role_assignment",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => userTable.id, { onDelete: "cascade" }),
    roleId: text("role_id")
      .notNull()
      .references(() => instanceRoleTable.id, { onDelete: "cascade" }),
  },
  (table) => [index("instance_role_assignment_role_idx").on(table.roleId)],
);

export const instanceWebhookTable = pgTable("instance_webhook", {
  id: text("id").primaryKey().$defaultFn(createId),
  name: text("name").notNull(),
  url: text("url").notNull(),
  signingSecret: text("signing_secret").notNull(),
  categories: jsonb("categories").$type<string[]>().notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const instanceWebhookDeliveryTable = pgTable(
  "instance_webhook_delivery",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    webhookId: text("webhook_id")
      .notNull()
      .references(() => instanceWebhookTable.id, { onDelete: "cascade" }),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    state: text("state").default("pending").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    statusCode: integer("status_code"),
    errorCode: text("error_code"),
    nextAttemptAt: timestamp("next_attempt_at", { mode: "date" })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    deliveredAt: timestamp("delivered_at", { mode: "date" }),
  },
  (table) => [
    index("instance_webhook_delivery_pending_idx").on(
      table.state,
      table.nextAttemptAt,
    ),
    index("instance_webhook_delivery_webhook_idx").on(
      table.webhookId,
      table.createdAt,
    ),
  ],
);
