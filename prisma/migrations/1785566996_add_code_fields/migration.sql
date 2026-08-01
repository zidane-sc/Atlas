-- Add code columns
ALTER TABLE "projects" ADD COLUMN     "code" TEXT;
ALTER TABLE "tasks" ADD COLUMN     "code" TEXT;

-- Create missing indexes
CREATE INDEX "activity_logs_actor_id_idx" ON "activity_logs"("actor_id");
CREATE INDEX "notes_userId_created_at_idx" ON "notes"("userId", "created_at");
CREATE INDEX "notes_userId_pinned_idx" ON "notes"("userId", "pinned");
CREATE UNIQUE INDEX "projects_code_key" ON "projects"("code");
CREATE INDEX "tasks_owner_id_idx" ON "tasks"("owner_id");
CREATE INDEX "tasks_owner_id_status_idx" ON "tasks"("owner_id", "status");
CREATE INDEX "tasks_owner_id_deleted_at_idx" ON "tasks"("owner_id", "deleted_at");
CREATE UNIQUE INDEX "tasks_owner_id_code_key" ON "tasks"("owner_id", "code");
