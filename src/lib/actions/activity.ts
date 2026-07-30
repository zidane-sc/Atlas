import { Prisma } from "@/generated/prisma/client";

interface ActivityParams {
  taskId?: string;
  projectId?: string;
  sprintId?: string;
  action: string;
  details?: Prisma.InputJsonValue;
}

export async function logActivity(
  tx: Prisma.TransactionClient,
  actorId: string,
  params: ActivityParams
) {
  await tx.activityLog.create({
    data: {
      actorId,
      taskId: params.taskId,
      projectId: params.projectId,
      sprintId: params.sprintId,
      action: params.action,
      details: params.details || undefined,
    },
  });
}
