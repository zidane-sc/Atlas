-- CreateTable
CREATE TABLE "_ProjectToSprint" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_ProjectToSprint_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_ProjectToSprint_B_index" ON "_ProjectToSprint"("B");

-- AddForeignKey
ALTER TABLE "_ProjectToSprint" ADD CONSTRAINT "_ProjectToSprint_A_fkey" FOREIGN KEY ("A") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProjectToSprint" ADD CONSTRAINT "_ProjectToSprint_B_fkey" FOREIGN KEY ("B") REFERENCES "sprints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill existing sprint -> project links into the new join table before dropping the column
INSERT INTO "_ProjectToSprint" ("A", "B")
SELECT "project_id", "id" FROM "sprints" WHERE "project_id" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "sprints" DROP CONSTRAINT "sprints_project_id_fkey";

-- AlterTable
ALTER TABLE "sprints" DROP COLUMN "project_id";
