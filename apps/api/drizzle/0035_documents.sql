CREATE TABLE "document" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"folder_id" text,
	"name" text NOT NULL,
	"storage_key" text NOT NULL,
	"size" integer NOT NULL,
	"content_type" text NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "folder" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"parent_id" text,
	"name" text NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_folder_id_folder_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folder"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "folder" ADD CONSTRAINT "folder_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "folder" ADD CONSTRAINT "folder_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "folder" ADD CONSTRAINT "folder_parent_id_folder_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."folder"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "document_projectId_idx" ON "document" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "document_folderId_idx" ON "document" USING btree ("folder_id");--> statement-breakpoint
CREATE INDEX "folder_projectId_idx" ON "folder" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "folder_parentId_idx" ON "folder" USING btree ("parent_id");