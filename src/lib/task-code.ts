export function generateTaskCode(projectCode: string, nextNumber: number): string {
  return `${projectCode.toUpperCase()}-${nextNumber}`;
}

export async function getNextTaskCodeNumber(db: any, ownerId: string, prefix: string = "TASK"): Promise<number> {
  const prefixUpper = prefix.toUpperCase();

  // If findMany is available, query all task codes with this prefix and extract true numeric maximum.
  // This avoids lexicographical sort bugs where 'TASK-9' > 'TASK-10'.
  if (typeof db.task?.findMany === "function") {
    const tasks = await db.task.findMany({
      where: {
        ownerId,
        code: { startsWith: `${prefixUpper}-` },
      },
      select: { code: true },
    });

    if (!tasks || tasks.length === 0) return 1;

    let maxNum = 0;
    const regex = new RegExp(`^${prefixUpper}-(\\d+)$`);
    for (const t of tasks) {
      if (!t?.code) continue;
      const match = t.code.match(regex);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    return maxNum + 1;
  }

  // Fallback for mocks implementing findFirst only
  const lastTask = await db.task.findFirst({
    where: {
      ownerId,
      code: { startsWith: `${prefixUpper}-` },
    },
    orderBy: { code: "desc" },
    select: { code: true },
  });

  if (!lastTask?.code) return 1;

  const match = lastTask.code.match(/-(\d+)$/);
  return match ? parseInt(match[1], 10) + 1 : 1;
}

