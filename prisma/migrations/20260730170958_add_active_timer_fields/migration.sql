-- AlterTable
ALTER TABLE "users" ADD COLUMN     "active_timer_started_at" TIMESTAMP(3),
ADD COLUMN     "active_timer_task_id" UUID;
