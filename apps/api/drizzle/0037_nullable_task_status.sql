ALTER TABLE "task" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "task" ALTER COLUMN "status" DROP NOT NULL;--> statement-breakpoint
UPDATE "task" SET "status" = NULL WHERE "status" IN ('planned','archived');
