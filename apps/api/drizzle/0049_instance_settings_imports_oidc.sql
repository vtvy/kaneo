CREATE TABLE "import_run" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" text,
	"source" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"include_comments" boolean DEFAULT true NOT NULL,
	"message" text,
	"projects" jsonb NOT NULL,
	"error" text,
	"heartbeat_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "instance_settings" (
	"id" text PRIMARY KEY DEFAULT 'instance' NOT NULL,
	"instance_name" text,
	"registration_enabled" boolean DEFAULT true NOT NULL,
	"password_registration_enabled" boolean DEFAULT true NOT NULL,
	"require_email_verification" boolean DEFAULT false NOT NULL,
	"workspace_creation_restricted" boolean DEFAULT false NOT NULL,
	"disabled_integrations" text[] DEFAULT '{}' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "oidc_sid" text;--> statement-breakpoint
ALTER TABLE "workspace" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
ALTER TABLE "workspace" ADD COLUMN "archived_by" text;--> statement-breakpoint
ALTER TABLE "import_run" ADD CONSTRAINT "import_run_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "import_run" ADD CONSTRAINT "import_run_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "import_run_workspace_created_idx" ON "import_run" USING btree ("workspace_id","created_at");--> statement-breakpoint
ALTER TABLE "workspace" ADD CONSTRAINT "workspace_archived_by_user_id_fk" FOREIGN KEY ("archived_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "session_oidcSid_idx" ON "session" USING btree ("oidc_sid");