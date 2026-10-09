import { db } from "@/lib/db";
import { mapDbTaskToClient, mapDbProjectToClient, mapDbSprintToClient } from "@/lib/tasks-reducer";
import { computeCharacterSheet, computeUnlockedAchievements, type CharacterSheet } from "@/lib/gamification";
import type { Task } from "@/types/task";
import type { Project, Sprint } from "@/types/gamification";

export interface CharacterSheetData {
  characterSheet: CharacterSheet;
  unlockedAchievements: Record<string, { unlocked: boolean; unlockedAt: string | null }>;
}

export interface PreloadedGamificationData {
  tasks: Task[];
  projects: Project[];
  sprints: Sprint[];
  bonusXp?: number;
  bonusCoins?: number;
}

/**
 * Self-contained: given an ownerId (already resolved/verified by the caller — this is an
 * internal utility, not a page-level entry point, so it does no auth of its own), computes
 * the character sheet + achievement unlock state fresh from the DB. Called once per page
 * load (layout.tsx) and again after mutations that can change XP/coins/achievements
 * (updateTask, createTask, claimDailyQuestAction) so the response carries the authoritative
 * post-mutation value inline instead of the client recomputing from a possibly-stale array.
 * If preloaded data is provided (e.g. from layout.tsx), re-queries to the DB are skipped.
 */
export async function getCharacterSheetData(
  ownerId: string,
  preloaded?: PreloadedGamificationData
): Promise<CharacterSheetData> {
  if (preloaded) {
    return {
      characterSheet: computeCharacterSheet(preloaded.tasks, preloaded.bonusXp ?? 0, preloaded.bonusCoins ?? 0),
      unlockedAchievements: computeUnlockedAchievements(preloaded.tasks, preloaded.projects, preloaded.sprints),
    };
  }

  const [dbDoneTasks, dbProjects, dbSprints, owner] = await Promise.all([
    db.task.findMany({ where: { ownerId, deletedAt: null, status: "done" } }),
    db.project.findMany({ where: { ownerId, archivedAt: null } }),
    db.sprint.findMany({ where: { ownerId }, include: { projects: { select: { id: true } } } }),
    db.user.findUnique({ where: { id: ownerId }, select: { bonusXp: true, bonusCoins: true } }),
  ]);

  if (!owner) {
    throw new Error(`getCharacterSheetData: user ${ownerId} not found`);
  }

  const tasks = dbDoneTasks.map((t) => mapDbTaskToClient(t, dbProjects, dbSprints));
  const projects = dbProjects.map(mapDbProjectToClient);
  const sprints = dbSprints.map(mapDbSprintToClient);

  return {
    characterSheet: computeCharacterSheet(tasks, owner.bonusXp, owner.bonusCoins),
    unlockedAchievements: computeUnlockedAchievements(tasks, projects, sprints),
  };
}
