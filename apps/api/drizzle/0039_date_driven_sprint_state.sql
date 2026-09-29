UPDATE "sprint" SET "state" = 'future' WHERE "state" = 'active';--> statement-breakpoint
DROP INDEX IF EXISTS "sprint_one_active_per_project_uidx";