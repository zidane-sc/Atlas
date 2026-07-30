-- AlterTable
ALTER TABLE "users" ADD COLUMN     "saved_filters" JSONB NOT NULL DEFAULT '[]';
