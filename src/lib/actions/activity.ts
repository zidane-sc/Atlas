import { Prisma } from "@/generated/prisma/client";

interface ActivityParams {
  taskId?: string;
  projectId?: string;
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
      action: params.action,
      details: params.details || undefined,
    },
    select: { id: true },
  });
}
