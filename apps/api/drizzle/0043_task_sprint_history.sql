CREATE TABLE "task_sprint" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"sprint_id" text NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL,
	"removed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "task_sprint_task_sprint_unique" UNIQUE("task_id","sprint_id")
);
--> statement-breakpoint
ALTER TABLE "task_sprint" ADD CONSTRAINT "task_sprint_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "task_sprint" ADD CONSTRAINT "task_sprint_sprint_id_sprint_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprint"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "task_sprint_taskId_idx" ON "task_sprint" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "task_sprint_sprintId_idx" ON "task_sprint" USING btree ("sprint_id");--> statement-breakpoint
-- Backfill: every task currently in a sprint gets an open membership row.
INSERT INTO "task_sprint" ("id", "task_id", "sprint_id", "added_at", "removed_at", "created_at", "updated_at")
SELECT "task"."id" || ':sprint', "task"."id", "task"."sprint_id", GREATEST("task"."created_at", "sprint"."created_at"), NULL, now(), now()
FROM "task"
INNER JOIN "sprint" ON "sprint"."id" = "task"."sprint_id"
ON CONFLICT DO NOTHING;
