-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "relations" JSONB NOT NULL DEFAULT '[]';
