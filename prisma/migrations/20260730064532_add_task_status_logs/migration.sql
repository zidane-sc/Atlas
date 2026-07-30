-- CreateTable
CREATE TABLE "task_status_logs" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "from_status" "task_status",
    "to_status" "task_status" NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_status_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "task_status_logs" ADD CONSTRAINT "task_status_logs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
