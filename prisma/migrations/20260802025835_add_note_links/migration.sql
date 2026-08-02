-- CreateTable
CREATE TABLE "note_links" (
    "id" TEXT NOT NULL,
    "noteAId" TEXT NOT NULL,
    "noteBId" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "note_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "note_links_noteBId_idx" ON "note_links"("noteBId");

-- CreateIndex
CREATE UNIQUE INDEX "note_links_noteAId_noteBId_key" ON "note_links"("noteAId", "noteBId");

-- AddForeignKey
ALTER TABLE "note_links" ADD CONSTRAINT "note_links_noteAId_fkey" FOREIGN KEY ("noteAId") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_links" ADD CONSTRAINT "note_links_noteBId_fkey" FOREIGN KEY ("noteBId") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
