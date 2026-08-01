export function generateTaskCode(projectCode: string, nextNumber: number): string {
  return `${projectCode.toUpperCase()}-${nextNumber}`;
}

export async function getNextTaskCodeNumber(db: any, ownerId: string): Promise<number> {
  const lastTask = await db.task.findFirst({
    where: { ownerId, code: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { code: true },
  });

  if (!lastTask?.code) return 1;

  const match = lastTask.code.match(/-(\d+)$/);
  return match ? parseInt(match[1]) + 1 : 1;
}
