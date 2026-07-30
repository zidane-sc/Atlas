-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "attachments" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "deliverables" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "tags" TEXT[];
