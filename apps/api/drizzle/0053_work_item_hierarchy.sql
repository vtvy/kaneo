ALTER TABLE "task" ADD COLUMN "type" text DEFAULT 'task' NOT NULL;
ALTER TABLE "task" ADD COLUMN "parent_id" text;
ALTER TABLE "task" ADD COLUMN "backlog_rank" integer DEFAULT 0 NOT NULL;
WITH ranked AS (SELECT id, row_number() OVER (PARTITION BY project_id ORDER BY position, number, created_at) AS rank FROM task)
UPDATE task SET backlog_rank = ranked.rank FROM ranked WHERE task.id = ranked.id;
ALTER TABLE "task" ADD CONSTRAINT "task_type_check" CHECK ("type" IN ('epic','feature','backlog_item','task','bug'));
ALTER TABLE "task" ADD CONSTRAINT "task_parent_not_self" CHECK ("parent_id" IS NULL OR "parent_id" <> "id");
ALTER TABLE "task" ADD CONSTRAINT "task_parent_id_task_id_fk" FOREIGN KEY ("parent_id") REFERENCES "task"("id") ON DELETE SET NULL;
CREATE INDEX "task_parentId_idx" ON "task" ("parent_id");
--> statement-breakpoint
CREATE FUNCTION validate_work_item_parent() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_type text; parent_project text;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    SELECT type, project_id INTO parent_type, parent_project FROM task WHERE id = NEW.parent_id FOR UPDATE;
    IF parent_project IS DISTINCT FROM NEW.project_id OR NOT (
      (parent_type = 'epic' AND NEW.type = 'feature') OR
      (parent_type = 'feature' AND NEW.type IN ('backlog_item','bug')) OR
      (parent_type IN ('backlog_item','bug') AND NEW.type = 'task')
    ) THEN RAISE EXCEPTION 'Invalid work item parent' USING ERRCODE = '23514'; END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM task child WHERE child.parent_id = NEW.id AND
    (child.project_id <> NEW.project_id OR NOT (
      (NEW.type = 'epic' AND child.type = 'feature') OR
      (NEW.type = 'feature' AND child.type IN ('backlog_item','bug')) OR
      (NEW.type IN ('backlog_item','bug') AND child.type = 'task')
    ))) THEN RAISE EXCEPTION 'Detach children before changing work item type or project' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER task_hierarchy_guard BEFORE INSERT OR UPDATE OF parent_id, type, project_id ON task
FOR EACH ROW EXECUTE FUNCTION validate_work_item_parent();
