CREATE TABLE "calendar_feed" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"label_names" text[] DEFAULT '{}' NOT NULL,
	"time_zone" text DEFAULT 'UTC' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calendar_feed" ADD CONSTRAINT "calendar_feed_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "calendar_feed" ADD CONSTRAINT "calendar_feed_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_feed_token_hash_unique" ON "calendar_feed" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "calendar_feed_project_user_idx" ON "calendar_feed" USING btree ("project_id","user_id");--> statement-breakpoint
CREATE INDEX "calendar_feed_userId_idx" ON "calendar_feed" USING btree ("user_id");