/*
  Warnings:

  - Added the required column `project_id` to the `sprints` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "sprints" ADD COLUMN     "project_id" UUID NOT NULL;

-- AddForeignKey
ALTER TABLE "sprints" ADD CONSTRAINT "sprints_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
