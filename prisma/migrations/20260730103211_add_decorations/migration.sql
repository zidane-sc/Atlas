-- AlterTable
ALTER TABLE "users" ADD COLUMN     "placed_decorations" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "purchased_decorations" TEXT[] DEFAULT ARRAY[]::TEXT[];
