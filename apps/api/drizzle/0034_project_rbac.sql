CREATE TABLE "project_member_role" (
	"id" text PRIMARY KEY NOT NULL,
	"project_member_id" text NOT NULL,
	"project_role_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_member_role_member_role_unique" UNIQUE("project_member_id","project_role_id")
);
--> statement-breakpoint
CREATE TABLE "project_member" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_member_project_user_unique" UNIQUE("project_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "project_role_permission" (
	"id" text PRIMARY KEY NOT NULL,
	"project_role_id" text NOT NULL,
	"resource" text NOT NULL,
	"action" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_role" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "reporter_id" text;--> statement-breakpoint
ALTER TABLE "project_member_role" ADD CONSTRAINT "project_member_role_project_member_id_project_member_id_fk" FOREIGN KEY ("project_member_id") REFERENCES "public"."project_member"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_member_role" ADD CONSTRAINT "project_member_role_project_role_id_project_role_id_fk" FOREIGN KEY ("project_role_id") REFERENCES "public"."project_role"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_member" ADD CONSTRAINT "project_member_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_member" ADD CONSTRAINT "project_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_role_permission" ADD CONSTRAINT "project_role_permission_project_role_id_project_role_id_fk" FOREIGN KEY ("project_role_id") REFERENCES "public"."project_role"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_role" ADD CONSTRAINT "project_role_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "project_member_role_memberId_idx" ON "project_member_role" USING btree ("project_member_id");--> statement-breakpoint
CREATE INDEX "project_member_role_roleId_idx" ON "project_member_role" USING btree ("project_role_id");--> statement-breakpoint
CREATE INDEX "project_member_projectId_idx" ON "project_member" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_member_userId_idx" ON "project_member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "project_role_permission_roleId_idx" ON "project_role_permission" USING btree ("project_role_id");--> statement-breakpoint
CREATE INDEX "project_role_projectId_idx" ON "project_role" USING btree ("project_id");--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_reporter_id_user_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;