export function generateTaskCode(projectCode: string, nextNumber: number): string {
  return `${projectCode.toUpperCase()}-${nextNumber}`;
}

export async function getNextTaskCodeNumber(db: any, ownerId: string, prefix: string = "TASK"): Promise<number> {
  // Query max code number directly using findFirst with orderBy on code desc.
  // This avoids the createdAt race where concurrent creates could read the same "last" task.
  const lastTask = await db.task.findFirst({
    where: {
      ownerId,
      code: { startsWith: `${prefix.toUpperCase()}-` },
    },
    orderBy: { code: "desc" }, // Lexicographic sort works for ATS-1, ATS-2, ..., ATS-10, ATS-11
    select: { code: true },
  });

  if (!lastTask?.code) return 1;

  const match = lastTask.code.match(/-(\d+)$/);
  return match ? parseInt(match[1]) + 1 : 1;
}

