import { db } from "@/lib/db";
import { mapDbTaskToClient, mapDbProjectToClient, mapDbSprintToClient } from "@/lib/tasks-reducer";
import { computeCharacterSheet, computeUnlockedAchievements, type CharacterSheet } from "@/lib/gamification";

export interface CharacterSheetData {
  characterSheet: CharacterSheet;
  unlockedAchievements: Record<string, { unlocked: boolean; unlockedAt: string | null }>;
}

/**
 * Self-contained: given an ownerId (already resolved/verified by the caller — this is an
 * internal utility, not a page-level entry point, so it does no auth of its own), computes
 * the character sheet + achievement unlock state fresh from the DB. Called once per page
 * load (layout.tsx) and again after every mutation that can change XP/coins/achievements
 * (updateTask, createTask, claimDailyQuestAction) so the response carries the authoritative
 * post-mutation value inline instead of the client recomputing from a possibly-stale array.
 */
export async function getCharacterSheetData(ownerId: string): Promise<CharacterSheetData> {
  const [dbDoneTasks, dbProjects, dbSprints, owner] = await Promise.all([
    db.task.findMany({ where: { ownerId, deletedAt: null, status: "done" } }),
    db.project.findMany({ where: { archivedAt: null } }),
    db.sprint.findMany(),
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
