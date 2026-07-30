-- CreateEnum
CREATE TYPE "task_status" AS ENUM ('inbox', 'todo', 'ready', 'in_progress', 'blocked', 'waiting_external', 'testing', 'done', 'archived');

-- CreateEnum
CREATE TYPE "task_type" AS ENUM ('coding', 'investigation', 'study', 'analysis', 'documentation', 'bug', 'deployment', 'testing', 'meeting', 'research', 'design', 'maintenance', 'refactor', 'incident', 'communication');

-- CreateEnum
CREATE TYPE "task_priority" AS ENUM ('p0', 'p1', 'p2', 'p3', 'p4');

-- CreateEnum
CREATE TYPE "task_effort" AS ENUM ('xs', 's', 'm', 'l', 'xl', 'xxl');

-- CreateEnum
CREATE TYPE "task_reporter" AS ENUM ('self', 'qa', 'manager', 'pm', 'client', 'lecturer', 'friend', 'other');

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "project_id" UUID,
    "sprint_id" UUID,
    "parent_id" UUID,
    "status" "task_status" NOT NULL,
    "type" "task_type" NOT NULL,
    "priority" "task_priority" NOT NULL,
    "effort" "task_effort",
    "story_point" INTEGER,
    "reporter" "task_reporter" NOT NULL DEFAULT 'self',
    "owner_id" UUID,
    "start_date" DATE,
    "due_date" DATE,
    "completed_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "tasks"("status");

-- CreateIndex
CREATE INDEX "tasks_project_id_idx" ON "tasks"("project_id");

-- CreateIndex
CREATE INDEX "tasks_due_date_idx" ON "tasks"("due_date");

-- CreateIndex
CREATE INDEX "tasks_parent_id_idx" ON "tasks"("parent_id");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
