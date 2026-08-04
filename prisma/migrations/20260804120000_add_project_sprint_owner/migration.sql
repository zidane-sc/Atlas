/*
  Warnings:

  - Added the required column `owner_id` to the `projects` table without a default value. This is not possible if the table is not empty.
  - Added the required column `owner_id` to the `sprints` table without a default value. This is not possible if the table is not empty.

  Backfill: existing rows had no owner (a schema gap that let every account see every
  other account's projects/sprints). Assigned to the oldest user account on file.
*/
-- AlterTable
ALTER TABLE "projects" ADD COLUMN "owner_id" UUID;
ALTER TABLE "sprints" ADD COLUMN "owner_id" UUID;

-- Backfill
UPDATE "projects" SET "owner_id" = (SELECT "id" FROM "users" ORDER BY "created_at" ASC LIMIT 1) WHERE "owner_id" IS NULL;
UPDATE "sprints" SET "owner_id" = (SELECT "id" FROM "users" ORDER BY "created_at" ASC LIMIT 1) WHERE "owner_id" IS NULL;

-- Enforce NOT NULL now that every row has an owner
ALTER TABLE "projects" ALTER COLUMN "owner_id" SET NOT NULL;
ALTER TABLE "sprints" ALTER COLUMN "owner_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sprints" ADD CONSTRAINT "sprints_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "projects_owner_id_idx" ON "projects"("owner_id");
CREATE INDEX "sprints_owner_id_idx" ON "sprints"("owner_id");
