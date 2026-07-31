-- AlterTable
ALTER TABLE "users" ADD COLUMN     "guild" TEXT DEFAULT 'Adventurer';

-- CreateTable
CREATE TABLE "notes" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "note_attachments" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "note_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "note_task_links" (
    "noteId" TEXT NOT NULL,
    "taskId" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "note_task_links_pkey" PRIMARY KEY ("noteId","taskId")
);

-- CreateIndex
CREATE INDEX "notes_userId_idx" ON "notes"("userId");

-- CreateIndex
CREATE INDEX "notes_created_at_idx" ON "notes"("created_at");

-- CreateIndex
CREATE INDEX "note_attachments_noteId_idx" ON "note_attachments"("noteId");

-- CreateIndex
CREATE INDEX "note_task_links_taskId_idx" ON "note_task_links"("taskId");

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_attachments" ADD CONSTRAINT "note_attachments_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_task_links" ADD CONSTRAINT "note_task_links_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_task_links" ADD CONSTRAINT "note_task_links_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
