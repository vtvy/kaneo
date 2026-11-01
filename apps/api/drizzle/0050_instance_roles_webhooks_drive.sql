CREATE TABLE "instance_role_assignment" (
	"user_id" text PRIMARY KEY NOT NULL,
	"role_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instance_role" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"permissions" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "instance_role_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "instance_webhook_delivery" (
	"id" text PRIMARY KEY NOT NULL,
	"webhook_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"status_code" integer,
	"error_code" text,
	"next_attempt_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"delivered_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "instance_webhook" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"signing_secret" text NOT NULL,
	"categories" jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document" ALTER COLUMN "storage_key" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "source" text DEFAULT 'server' NOT NULL;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "external_url" text;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "drive_managed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "instance_role_assignment" ADD CONSTRAINT "instance_role_assignment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instance_role_assignment" ADD CONSTRAINT "instance_role_assignment_role_id_instance_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."instance_role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instance_webhook_delivery" ADD CONSTRAINT "instance_webhook_delivery_webhook_id_instance_webhook_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."instance_webhook"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "instance_role_assignment_role_idx" ON "instance_role_assignment" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "instance_webhook_delivery_pending_idx" ON "instance_webhook_delivery" USING btree ("state","next_attempt_at");--> statement-breakpoint
CREATE INDEX "instance_webhook_delivery_webhook_idx" ON "instance_webhook_delivery" USING btree ("webhook_id","created_at");