-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "time_spent_seconds" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "work_sessions" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3) NOT NULL,
    "duration_seconds" INTEGER NOT NULL,

    CONSTRAINT "work_sessions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "work_sessions" ADD CONSTRAINT "work_sessions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
