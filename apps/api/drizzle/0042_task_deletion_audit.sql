CREATE TABLE "task_deletion" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"task_number" integer,
	"task_title" text NOT NULL,
	"project_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"deleted_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "task_deletion" ADD CONSTRAINT "task_deletion_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "task_deletion" ADD CONSTRAINT "task_deletion_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "task_deletion" ADD CONSTRAINT "task_deletion_deleted_by_user_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "task_deletion_projectId_idx" ON "task_deletion" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "task_deletion_workspaceId_idx" ON "task_deletion" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "task_deletion_deletedBy_idx" ON "task_deletion" USING btree ("deleted_by");--> statement-breakpoint
CREATE INDEX "task_deletion_taskId_idx" ON "task_deletion" USING btree ("task_id");
