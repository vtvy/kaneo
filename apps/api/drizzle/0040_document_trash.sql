ALTER TABLE "document" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "deleted_by" text;--> statement-breakpoint
ALTER TABLE "folder" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "folder" ADD COLUMN "deleted_by" text;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_deleted_by_user_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "folder" ADD CONSTRAINT "folder_deleted_by_user_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;