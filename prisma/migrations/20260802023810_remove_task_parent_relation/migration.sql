/*
  Warnings:

  - You are about to drop the column `parent_id` on the `tasks` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_parent_id_fkey";

-- DropIndex
DROP INDEX "tasks_parent_id_idx";

-- AlterTable
ALTER TABLE "tasks" DROP COLUMN "parent_id";
