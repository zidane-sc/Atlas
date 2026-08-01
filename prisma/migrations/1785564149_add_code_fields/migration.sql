-- Add code column to Task
ALTER TABLE "tasks" ADD COLUMN "code" TEXT;

-- Add code column to Project  
ALTER TABLE "projects" ADD COLUMN "code" TEXT UNIQUE;

-- Create unique index for task code per user
CREATE UNIQUE INDEX "tasks_ownerId_code_key" ON "tasks"("owner_id", "code");

-- Make code non-null after backfill
