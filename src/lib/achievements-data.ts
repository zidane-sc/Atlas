import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { mapDbTaskToClient, mapDbProjectToClient } from "@/lib/tasks-reducer";
import { computeAchievementProgress, computeUnlockedAchievements } from "@/lib/gamification";
import { mockAchievements } from "@/lib/mock-data";
import type { Achievement } from "@/types/gamification";

export interface AchievementDisplay extends Achievement {
  progress: { current: number; max: number } | null;
}

export async function getAchievementsPageData(): Promise<AchievementDisplay[] | null> {
  const session = await auth();
  if (!session?.user?.email) return null;

  const owner = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
  if (!owner) return null;

  const [dbTasks, dbProjects] = await Promise.all([
    db.task.findMany({
      where: { ownerId: owner.id, deletedAt: null },
      select: {
        id: true,
        code: true,
        title: true,
        status: true,
        type: true,
        priority: true,
        size: true,
        projectId: true,
        completedAt: true,
        dueDate: true,
        startDate: true,
        createdAt: true,
      },
    }),
    db.project.findMany({ where: { ownerId: owner.id, archivedAt: null } }),
  ]);

  const tasks = dbTasks.map((t) => mapDbTaskToClient(t, dbProjects, []));
  const projects = dbProjects.map(mapDbProjectToClient);

  const unlockStatus = computeUnlockedAchievements(tasks, projects, []);

  return mockAchievements.map((a) => {
    const status = unlockStatus[a.id];
    return {
      ...a,
      unlocked: status.unlocked,
      unlockedAt: status.unlockedAt,
      progress: status.unlocked ? null : computeAchievementProgress(a.id, tasks, projects, []),
    };
  });
}
