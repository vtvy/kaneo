CREATE TABLE "task_involvement" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"user_id" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "task_involvement_task_user_unique" UNIQUE("task_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "task_involvement" ADD CONSTRAINT "task_involvement_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "task_involvement" ADD CONSTRAINT "task_involvement_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "task_involvement_taskId_idx" ON "task_involvement" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "task_involvement_userId_idx" ON "task_involvement" USING btree ("user_id");--> statement-breakpoint
INSERT INTO "task_involvement" ("id", "task_id", "user_id", "reason", "created_at", "updated_at")
SELECT
  concat('inv_', t.id, '_', t.reporter_id),
  t.id,
  t.reporter_id,
  'reporter',
  now(),
  now()
FROM "task" t
WHERE t.reporter_id IS NOT NULL
ON CONFLICT ("task_id", "user_id") DO NOTHING;--> statement-breakpoint
INSERT INTO "task_involvement" ("id", "task_id", "user_id", "reason", "created_at", "updated_at")
SELECT
  concat('inv_', t.id, '_', t.assignee_id),
  t.id,
  t.assignee_id,
  'assignee',
  now(),
  now()
FROM "task" t
WHERE t.assignee_id IS NOT NULL
ON CONFLICT ("task_id", "user_id") DO NOTHING;
