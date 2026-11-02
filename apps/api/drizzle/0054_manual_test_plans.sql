CREATE TABLE "test_case" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"title" text NOT NULL,
	"preconditions" text DEFAULT '' NOT NULL,
	"steps" jsonb NOT NULL,
	"requirement_id" text,
	"state" text DEFAULT 'ready' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "test_plan" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"sprint_id" text,
	"release" text DEFAULT '' NOT NULL,
	"state" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "test_result" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"case_id" text,
	"snapshot" jsonb NOT NULL,
	"outcome" text DEFAULT 'not_run' NOT NULL,
	"steps" jsonb NOT NULL,
	"actual" text DEFAULT '' NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"bug_id" text,
	"updated_by" text,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "test_result_run_case_unique" UNIQUE("run_id","case_id")
);
--> statement-breakpoint
CREATE TABLE "test_run" (
	"id" text PRIMARY KEY NOT NULL,
	"plan_id" text NOT NULL,
	"suite_id" text,
	"title" text NOT NULL,
	"tester_id" text,
	"created_by" text,
	"environment" text DEFAULT '' NOT NULL,
	"build" text DEFAULT '' NOT NULL,
	"client_key" text NOT NULL,
	"state" text DEFAULT 'in_progress' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	CONSTRAINT "test_run_plan_client_unique" UNIQUE("plan_id","client_key")
);
--> statement-breakpoint
CREATE TABLE "test_suite_case" (
	"id" text PRIMARY KEY NOT NULL,
	"suite_id" text NOT NULL,
	"case_id" text NOT NULL,
	CONSTRAINT "test_suite_case_unique" UNIQUE("suite_id","case_id")
);
--> statement-breakpoint
CREATE TABLE "test_suite" (
	"id" text PRIMARY KEY NOT NULL,
	"plan_id" text NOT NULL,
	"title" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "test_case" ADD CONSTRAINT "test_case_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_case" ADD CONSTRAINT "test_case_requirement_id_task_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."task"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_plan" ADD CONSTRAINT "test_plan_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_plan" ADD CONSTRAINT "test_plan_sprint_id_sprint_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprint"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_result" ADD CONSTRAINT "test_result_run_id_test_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."test_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_result" ADD CONSTRAINT "test_result_case_id_test_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."test_case"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_result" ADD CONSTRAINT "test_result_bug_id_task_id_fk" FOREIGN KEY ("bug_id") REFERENCES "public"."task"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_result" ADD CONSTRAINT "test_result_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_run" ADD CONSTRAINT "test_run_plan_id_test_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."test_plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_run" ADD CONSTRAINT "test_run_suite_id_test_suite_id_fk" FOREIGN KEY ("suite_id") REFERENCES "public"."test_suite"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_run" ADD CONSTRAINT "test_run_tester_id_user_id_fk" FOREIGN KEY ("tester_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_run" ADD CONSTRAINT "test_run_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_suite_case" ADD CONSTRAINT "test_suite_case_suite_id_test_suite_id_fk" FOREIGN KEY ("suite_id") REFERENCES "public"."test_suite"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_suite_case" ADD CONSTRAINT "test_suite_case_case_id_test_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."test_case"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_suite" ADD CONSTRAINT "test_suite_plan_id_test_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."test_plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "test_case_project_idx" ON "test_case" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "test_plan_project_idx" ON "test_plan" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "test_result_run_idx" ON "test_result" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "test_run_plan_idx" ON "test_run" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "test_suite_case_case_idx" ON "test_suite_case" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "test_suite_plan_idx" ON "test_suite" USING btree ("plan_id");
--> statement-breakpoint
INSERT INTO project_role_permission (id,project_role_id,resource,action,created_at)
SELECT md5(role.id || ':manual-test:' || grant_action.action), role.id, 'test', grant_action.action, now()
FROM project_role role CROSS JOIN (VALUES ('read'),('design'),('manage'),('execute')) AS grant_action(action)
WHERE NOT EXISTS (SELECT 1 FROM project_role_permission current_permission WHERE current_permission.project_role_id=role.id AND current_permission.resource='test' AND current_permission.action=grant_action.action)
AND EXISTS (SELECT 1 FROM project_role_permission p WHERE p.project_role_id=role.id AND p.resource='item' AND p.action='read')
AND (grant_action.action='read' OR
  (grant_action.action='design' AND EXISTS (SELECT 1 FROM project_role_permission p WHERE p.project_role_id=role.id AND p.resource='item' AND p.action='create') AND EXISTS (SELECT 1 FROM project_role_permission p WHERE p.project_role_id=role.id AND p.resource='item' AND p.action='update')) OR
  (grant_action.action='manage' AND EXISTS (SELECT 1 FROM project_role_permission p WHERE p.project_role_id=role.id AND p.resource='backlog' AND p.action='manage') AND EXISTS (SELECT 1 FROM project_role_permission p WHERE p.project_role_id=role.id AND p.resource='item' AND p.action='update')) OR
  (grant_action.action='execute' AND EXISTS (SELECT 1 FROM project_role_permission p WHERE p.project_role_id=role.id AND p.resource='item' AND p.action='transition')));

--> statement-breakpoint
CREATE INDEX "test_case_requirement_idx" ON "test_case" USING btree ("requirement_id");
--> statement-breakpoint
CREATE INDEX "test_result_bug_idx" ON "test_result" USING btree ("bug_id");
