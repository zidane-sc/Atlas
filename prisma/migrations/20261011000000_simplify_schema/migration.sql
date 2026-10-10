-- Drop Sprint model and related M2M
-- Drop foreign keys first
ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_sprint_id_fkey";
DROP TABLE IF EXISTS "sprints" CASCADE;
DROP TABLE IF EXISTS "_ProjectToSprint" CASCADE;

-- Drop sprintId column from tasks
ALTER TABLE "tasks" DROP COLUMN IF EXISTS "sprint_id";

-- Update project_category enum
CREATE TYPE "project_category_new" AS ENUM ('work', 'personal', 'learning', 'other');
ALTER TABLE "projects" ALTER COLUMN "category" TYPE "project_category_new" USING 
  CASE 
    WHEN "category" = 'Full-time' THEN 'work'::"project_category_new"
    WHEN "category" = 'University' THEN 'learning'::"project_category_new"
    WHEN "category" = 'Side Project' THEN 'personal'::"project_category_new"
    WHEN "category" = 'Freelance' THEN 'work'::"project_category_new"
    WHEN "category" = 'Personal' THEN 'personal'::"project_category_new"
    ELSE 'other'::"project_category_new"
  END;
DROP TYPE "project_category";
ALTER TYPE "project_category_new" RENAME TO "project_category";

-- Update project_status enum
ALTER TABLE "projects" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "projects" ALTER COLUMN "status" TYPE TEXT;
DROP TYPE "project_status";
CREATE TYPE "project_status" AS ENUM ('active', 'completed', 'archived');
ALTER TABLE "projects" ALTER COLUMN "status" TYPE "project_status" USING 
  CASE 
    WHEN "status" = 'on_hold' THEN 'archived'::"project_status"
    ELSE "status"::"project_status"
  END;
ALTER TABLE "projects" ALTER COLUMN "status" SET DEFAULT 'active';

-- Update task_priority enum
ALTER TABLE "tasks" ALTER COLUMN "priority" TYPE TEXT;
DROP TYPE "task_priority";
CREATE TYPE "task_priority" AS ENUM ('high', 'medium', 'low');
ALTER TABLE "tasks" ALTER COLUMN "priority" TYPE "task_priority" USING 
  CASE 
    WHEN "priority" = 'p0' THEN 'high'::"task_priority"
    WHEN "priority" = 'p1' THEN 'high'::"task_priority"
    WHEN "priority" = 'p2' THEN 'medium'::"task_priority"
    WHEN "priority" = 'p3' THEN 'low'::"task_priority"
    WHEN "priority" = 'p4' THEN 'low'::"task_priority"
    ELSE 'medium'::"task_priority"
  END;

-- Update task_status enum
ALTER TABLE "tasks" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "tasks" ALTER COLUMN "status" TYPE TEXT;
ALTER TABLE "task_status_logs" ALTER COLUMN "from_status" TYPE TEXT;
ALTER TABLE "task_status_logs" ALTER COLUMN "to_status" TYPE TEXT;
DROP TYPE "task_status";
CREATE TYPE "task_status" AS ENUM ('backlog', 'todo', 'in_progress', 'done', 'archived');
ALTER TABLE "tasks" ALTER COLUMN "status" TYPE "task_status" USING 
  CASE 
    WHEN "status" = 'inbox' THEN 'backlog'::"task_status"
    WHEN "status" = 'ready' THEN 'todo'::"task_status"
    WHEN "status" = 'blocked' THEN 'in_progress'::"task_status"
    WHEN "status" = 'waiting_external' THEN 'in_progress'::"task_status"
    WHEN "status" = 'testing' THEN 'in_progress'::"task_status"
    ELSE "status"::"task_status"
  END;
ALTER TABLE "task_status_logs" ALTER COLUMN "from_status" TYPE "task_status" USING 
  CASE 
    WHEN "from_status" = 'inbox' THEN 'backlog'::"task_status"
    WHEN "from_status" = 'ready' THEN 'todo'::"task_status"
    WHEN "from_status" = 'blocked' THEN 'in_progress'::"task_status"
    WHEN "from_status" = 'waiting_external' THEN 'in_progress'::"task_status"
    WHEN "from_status" = 'testing' THEN 'in_progress'::"task_status"
    ELSE "from_status"::"task_status"
  END;
ALTER TABLE "task_status_logs" ALTER COLUMN "to_status" TYPE "task_status" USING 
  CASE 
    WHEN "to_status" = 'inbox' THEN 'backlog'::"task_status"
    WHEN "to_status" = 'ready' THEN 'todo'::"task_status"
    WHEN "to_status" = 'blocked' THEN 'in_progress'::"task_status"
    WHEN "to_status" = 'waiting_external' THEN 'in_progress'::"task_status"
    WHEN "to_status" = 'testing' THEN 'in_progress'::"task_status"
    ELSE "to_status"::"task_status"
  END;

-- Update task_type enum
ALTER TABLE "tasks" ALTER COLUMN "type" TYPE TEXT;
DROP TYPE "task_type";
CREATE TYPE "task_type" AS ENUM ('coding', 'research', 'design', 'documentation', 'bug', 'meeting', 'admin');
ALTER TABLE "tasks" ALTER COLUMN "type" TYPE "task_type" USING 
  CASE 
    WHEN "type" = 'investigation' THEN 'research'::"task_type"
    WHEN "type" = 'study' THEN 'research'::"task_type"
    WHEN "type" = 'analysis' THEN 'research'::"task_type"
    WHEN "type" = 'deployment' THEN 'admin'::"task_type"
    WHEN "type" = 'testing' THEN 'admin'::"task_type"
    WHEN "type" = 'maintenance' THEN 'admin'::"task_type"
    WHEN "type" = 'refactor' THEN 'coding'::"task_type"
    WHEN "type" = 'incident' THEN 'bug'::"task_type"
    WHEN "type" = 'communication' THEN 'meeting'::"task_type"
    ELSE "type"::"task_type"
  END;

-- Update task_relation_type enum
ALTER TABLE "task_relations" ALTER COLUMN "relation_type" TYPE TEXT;
DROP TYPE "task_relation_type";
CREATE TYPE "task_relation_type" AS ENUM ('blocks', 'relates_to', 'duplicates');
ALTER TABLE "task_relations" ALTER COLUMN "relation_type" TYPE "task_relation_type" USING 
  CASE 
    WHEN "relation_type" = 'related' THEN 'relates_to'::"task_relation_type"
    WHEN "relation_type" = 'duplicate' THEN 'duplicates'::"task_relation_type"
    WHEN "relation_type" = 'caused_by' THEN 'relates_to'::"task_relation_type"
    WHEN "relation_type" = 'generated_from' THEN 'relates_to'::"task_relation_type"
    ELSE "relation_type"::"task_relation_type"
  END;

-- Update task_reporter enum
ALTER TABLE "tasks" ALTER COLUMN "reporter" DROP DEFAULT;
ALTER TABLE "tasks" ALTER COLUMN "reporter" TYPE TEXT;
DROP TYPE "task_reporter";
CREATE TYPE "task_reporter" AS ENUM ('self', 'other');
ALTER TABLE "tasks" ALTER COLUMN "reporter" TYPE "task_reporter" USING 
  CASE 
    WHEN "reporter" IN ('qa', 'manager', 'pm', 'client', 'lecturer', 'friend') THEN 'other'::"task_reporter"
    ELSE "reporter"::"task_reporter"
  END;
ALTER TABLE "tasks" ALTER COLUMN "reporter" SET DEFAULT 'self';

-- Update attachment_type enum
ALTER TABLE "attachments" ALTER COLUMN "type" TYPE TEXT;
DROP TYPE "attachment_type";
CREATE TYPE "attachment_type" AS ENUM ('github_pr', 'github_issue', 'link', 'file', 'other');
ALTER TABLE "attachments" ALTER COLUMN "type" TYPE "attachment_type" USING 
  CASE 
    WHEN "type" = 'confluence' THEN 'link'::"attachment_type"
    WHEN "type" = 'figma' THEN 'link'::"attachment_type"
    WHEN "type" = 'slack' THEN 'link'::"attachment_type"
    WHEN "type" = 'discord' THEN 'link'::"attachment_type"
    WHEN "type" = 'google_docs' THEN 'link'::"attachment_type"
    WHEN "type" = 'google_drive' THEN 'link'::"attachment_type"
    WHEN "type" = 'meeting_recording' THEN 'file'::"attachment_type"
    WHEN "type" = 'website' THEN 'link'::"attachment_type"
    WHEN "type" = 'file_upload' THEN 'file'::"attachment_type"
    ELSE "type"::"attachment_type"
  END;

-- Update deliverable_type enum
ALTER TABLE "deliverables" ALTER COLUMN "type" TYPE TEXT;
DROP TYPE "deliverable_type";
CREATE TYPE "deliverable_type" AS ENUM ('pr', 'doc', 'design', 'other');
ALTER TABLE "deliverables" ALTER COLUMN "type" TYPE "deliverable_type" USING 
  CASE 
    WHEN "type" = 'confluence' THEN 'doc'::"deliverable_type"
    WHEN "type" = 'presentation' THEN 'doc'::"deliverable_type"
    WHEN "type" = 'meeting_notes' THEN 'doc'::"deliverable_type"
    WHEN "type" = 'video' THEN 'design'::"deliverable_type"
    WHEN "type" = 'pdf' THEN 'doc'::"deliverable_type"
    WHEN "type" = 'research' THEN 'doc'::"deliverable_type"
    ELSE "type"::"deliverable_type"
  END;

-- Update project_category enum for projects table
ALTER TABLE "projects" ALTER COLUMN "category" SET DEFAULT 'other';

-- Create TaskSize enum if not exists
DO $$ BEGIN
  CREATE TYPE "task_size" AS ENUM ('xs', 's', 'm', 'l', 'xl');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Add TaskSize column to tasks (default 'm')
ALTER TABLE "tasks" ADD COLUMN "size" "task_size" DEFAULT 'm';

-- Remove effort column from tasks (replaced by size)
ALTER TABLE "tasks" DROP COLUMN IF EXISTS "effort";

-- Remove story_point column from tasks
ALTER TABLE "tasks" DROP COLUMN IF EXISTS "story_point";

-- Remove parentId column and self-referential relation
ALTER TABLE "tasks" DROP COLUMN IF EXISTS "parent_id";
ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_parent_id_fkey";

-- Remove noteLinks relation (notes model removed)
ALTER TABLE "tasks" DROP COLUMN IF EXISTS "note_links";