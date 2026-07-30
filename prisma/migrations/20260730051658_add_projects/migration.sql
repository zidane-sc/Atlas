-- CreateEnum
CREATE TYPE "project_category" AS ENUM ('Full-time', 'University', 'Side Project', 'Freelance', 'Personal', 'Other');

-- CreateEnum
CREATE TYPE "project_status" AS ENUM ('active', 'on_hold', 'completed');

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" "project_category" NOT NULL,
    "color_var" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "description" TEXT,
    "status" "project_status" NOT NULL DEFAULT 'active',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
