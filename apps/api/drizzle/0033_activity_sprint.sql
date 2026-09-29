ALTER TABLE "activity" ALTER COLUMN "task_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "activity" ADD COLUMN "sprint_id" text;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_sprint_id_sprint_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprint"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "activity_sprint_id_idx" ON "activity" USING btree ("sprint_id");