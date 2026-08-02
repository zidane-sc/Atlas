import type { Priority, Task, TaskType } from "@/types/task";
import type { Project, Sprint } from "@/types/gamification";
import { notificationEmitter } from "@/hooks/useNotifications";
import { isDueSoon, isOverdue } from "@/lib/task-utils";

/** Priority base XP and coin bonus — docs/03-design.md §11.1, §11.5 */
export const PRIORITY_XP_BASE: Record<Priority, number> = {
  p0: 100,
  p1: 60,
  p2: 30,
  p3: 15,
  p4: 5,
};

export const PRIORITY_COIN_BONUS: Record<Priority, number> = {
  p0: 5,
  p1: 3,
  p2: 1,
  p3: 0,
  p4: 0,
};

/** XP required to go from level n to n+1 — docs/03-design.md §11.4 */
export function xpForLevel(n: number): number {
  return Math.round((100 * Math.pow(n, 1.5)) / 10) * 10;
}

export function getLevelInfo(xp: number): {
  level: number;
  currentXP: number;
  nextLevelXP: number;
} {
  // Not currently reachable (storyPoint/bonusXp are both validated non-negative), but the XP
  // double-counting bug (docs/05-backlog.md §8 finding #1) showed the bonus ledger isn't as
  // isolated as assumed — guard defensively rather than return a negative currentXP.
  xp = Math.max(0, xp);
  let cumulative = 0;
  let level = 1;
  while (true) {
    const need = xpForLevel(level);
    if (cumulative + need > xp) {
      return { level, currentXP: xp - cumulative, nextLevelXP: need };
    }
    cumulative += need;
    level++;
  }
}

/** Per-task XP — docs/03-design.md §11.1 */
export function calcTaskXP(
  priority: Priority,
  storyPoint: number | undefined,
  onTime: boolean
): number {
  const sp = storyPoint ?? 0;
  return Math.round((PRIORITY_XP_BASE[priority] + sp * 10) * (onTime ? 1.2 : 1));
}

/** Per-task coins — docs/03-design.md §11.5 */
export function calcTaskCoins(priority: Priority, storyPoint: number | undefined): number {
  return (storyPoint ?? 0) + PRIORITY_COIN_BONUS[priority];
}

export function completedAt(task: Task): string | null {
  return task.completedAt ?? task.statusHistory.find((h) => h.toStatus === "done")?.changedAt ?? null;
}

/**
 * Prefers the real `createdAt` DB column, falling back to the first status log entry for any
 * task object that predates that field being added to the client shape (docs/05-backlog.md §8
 * finding #16) — lets bulk task fetches drop the nested `statusHistory` include entirely.
 */
export function createdAt(task: Task): string | null {
  return task.createdAt ?? task.statusHistory[0]?.changedAt ?? null;
}

export function isTaskOnTime(task: Task): boolean {
  const done = completedAt(task);
  if (!task.dueDate || !done) return true;
  return new Date(done) <= new Date(`${task.dueDate}T23:59:59`);
}

/** Task Type → derived stat + class title — docs/03-design.md §11.8 */
export const SKILL_META: Record<
  TaskType,
  { title: string; desc: string; statName: string; colorVar: string }
> = {
  coding: { title: "Coder", desc: "Writing and shipping functional code", statName: "INT", colorVar: "--color-status-ready" },
  investigation: { title: "Investigator", desc: "Diagnosing and tracing down root causes", statName: "WIS", colorVar: "--color-status-testing" },
  study: { title: "Scholar", desc: "Learning, reading, and absorbing knowledge", statName: "INT", colorVar: "--color-status-waiting-external" },
  analysis: { title: "Analyst", desc: "Breaking down data and complex systems", statName: "WIS", colorVar: "--color-status-in-progress" },
  documentation: { title: "Chronicler", desc: "Capturing knowledge and writing clear docs", statName: "CHA", colorVar: "--color-text-muted" },
  bug: { title: "Bug Slayer", desc: "Hunting and eliminating defects", statName: "STR", colorVar: "--color-priority-p0" },
  deployment: { title: "Deployer", desc: "Shipping to production reliably", statName: "DEX", colorVar: "--color-status-done" },
  testing: { title: "Tester", desc: "Ensuring quality through systematic checks", statName: "WIS", colorVar: "--color-status-testing" },
  meeting: { title: "Diplomat", desc: "Communicating and aligning with others", statName: "CHA", colorVar: "--color-status-waiting-external" },
  research: { title: "Explorer", desc: "Discovering new ideas and possibilities", statName: "WIS", colorVar: "--color-status-ready" },
  design: { title: "Artisan", desc: "Crafting interfaces and visual experiences", statName: "CHA", colorVar: "--color-streak-flame" },
  maintenance: { title: "Keeper", desc: "Maintaining and improving existing systems", statName: "CON", colorVar: "--color-text-muted" },
  refactor: { title: "Refiner", desc: "Improving code without changing behavior", statName: "INT", colorVar: "--color-primary-gold" },
  incident: { title: "Firefighter", desc: "Responding fast under pressure", statName: "STR", colorVar: "--color-priority-p0" },
  communication: { title: "Herald", desc: "Keeping stakeholders informed and aligned", statName: "CHA", colorVar: "--color-status-waiting-external" },
};

export const STATS = ["STR", "DEX", "CON", "INT", "WIS", "CHA"] as const;

export interface CharacterSkill {
  type: TaskType;
  count: number;
  skillXP: number;
  level: number;
  currentXP: number;
  nextLevelXP: number;
}

export interface CharacterSheet {
  globalLevel: number;
  globalXP: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  totalCoins: number;
  statScore: Record<string, number>;
  skills: CharacterSkill[];
  classTitle: string;
  completedCount: number;
}

/**
 * Aggregate progression view derived entirely from completed tasks — docs/03-design.md §11.8.
 * `bonusXp`/`bonusCoins` fold in rewards with no backing task (e.g. a claimed Daily Quest) —
 * the one hook every XP/coin display should add through, instead of a second parallel ledger.
 */
export function computeCharacterSheet(tasks: Task[], bonusXp = 0, bonusCoins = 0): CharacterSheet {
  const done = tasks.filter((t) => t.status === "done");

  const typeXP: Partial<Record<TaskType, number>> = {};
  const typeCount: Partial<Record<TaskType, number>> = {};
  let totalCoins = bonusCoins;
  for (const t of done) {
    const earned = calcTaskXP(t.priority, t.storyPoint, isTaskOnTime(t));
    typeXP[t.type] = (typeXP[t.type] ?? 0) + earned;
    typeCount[t.type] = (typeCount[t.type] ?? 0) + 1;
    totalCoins += calcTaskCoins(t.priority, t.storyPoint);
  }

  const globalXP = Object.values(typeXP).reduce((s, v) => s + (v ?? 0), 0) + bonusXp;
  const { level: globalLevel, currentXP: xpIntoLevel, nextLevelXP: xpForNextLevel } = getLevelInfo(globalXP);

  const statScore: Record<string, number> = Object.fromEntries(
    STATS.map((s) => [s, 8])
  );
  for (const [type, meta] of Object.entries(SKILL_META) as [TaskType, (typeof SKILL_META)[TaskType]][]) {
    const { level } = getLevelInfo(typeXP[type] ?? 0);
    statScore[meta.statName] = Math.min(20, statScore[meta.statName] + Math.floor(level * 0.6));
  }

  const skills: CharacterSkill[] = (Object.keys(SKILL_META) as TaskType[])
    .map((type) => {
      const skillXP = typeXP[type] ?? 0;
      const { level, currentXP, nextLevelXP } = getLevelInfo(skillXP);
      return { type, count: typeCount[type] ?? 0, skillXP, level, currentXP, nextLevelXP };
    })
    .sort((a, b) => b.skillXP - a.skillXP);

  const topSkill = skills[0];
  const classTitle = topSkill && topSkill.level > 1 ? SKILL_META[topSkill.type].title : "Apprentice";

  return { globalLevel, globalXP, xpIntoLevel, xpForNextLevel, totalCoins, statScore, skills, classTitle, completedCount: done.length };
}

/** Companion mood — docs/03-design.md §11.9 */
export type CompanionMood = "excited" | "happy" | "idle" | "sad";

export function getCompanionMood(todayCompleted: number, justCompleted: boolean): CompanionMood {
  if (justCompleted) return "excited";
  if (todayCompleted >= 5) return "happy";
  if (todayCompleted >= 2) return "idle";
  return "sad";
}

/** Save & Quit farewell — docs/superpowers/specs/2026-07-31-save-and-quit-logout-design.md */
export interface Farewell {
  line: string;
  mood: CompanionMood;
}

export function getFarewell(doneCount: number, streakDays: number): Farewell {
  if (doneCount === 0) {
    return { line: "The realm will keep. See you tomorrow.", mood: "sad" };
  }
  if (streakDays >= 7) {
    return { line: "Legendary work, hero. The flame endures.", mood: "happy" };
  }
  if (streakDays >= 3) {
    return { line: "Nice quests today. The fire grows.", mood: "idle" };
  }
  return { line: "Every quest counts. Good session.", mood: "idle" };
}

/** Streak milestone bonuses — docs/03-design.md §11.3/§11.6 */
const STREAK_MILESTONES = [
  { days: 7, label: "Steady Fire" },
  { days: 14, label: "Bonfire" },
  { days: 30, label: "Blaze" },
] as const;

export function getNextStreakMilestone(streakDays: number): { label: string; daysLeft: number; target: number } | null {
  const next = STREAK_MILESTONES.find((m) => m.days > streakDays);
  if (!next) return null;
  return { label: next.label, daysLeft: next.days - streakDays, target: next.days };
}

/** Current streak tier flavor (icon + label) — reference-design's streakViz. */
export function getStreakVibe(streakDays: number): { icon: string; label: string } {
  if (streakDays >= 30) return { icon: "🔥🔥", label: "Blaze" };
  if (streakDays >= 14) return { icon: "🏕️", label: "Bonfire" };
  if (streakDays >= 7) return { icon: "🔥", label: "Steady Fire" };
  if (streakDays >= 3) return { icon: "🕯️", label: "Small Flame" };
  return { icon: "✨", label: "Spark" };
}

/** Weekly/Monthly Recap grade — docs/03-design.md §11.10 */
export type RecapGrade = "S" | "A" | "B" | "C" | "D";

export function computeRecapGrade(done: number, created: number): RecapGrade {
  const velocity = done / Math.max(created, 1);
  if (velocity >= 1) return "S";
  if (velocity >= 0.7) return "A";
  if (velocity >= 0.45) return "B";
  if (velocity >= 0.25) return "C";
  return "D";
}

/** Every currently-known achievement id — the switch in computeAchievementProgress covers each one. */
export const ACHIEVEMENT_IDS = ["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8", "a9", "a10", "a11", "a12", "a13", "a14"] as const;

/** Countable progress toward a locked achievement's threshold — docs/03-design.md §11.7 */
export function computeAchievementProgress(
  id: string,
  tasks: Task[],
  projects: Project[],
  sprints: Sprint[]
): { current: number; max: number } | null {
  const done = tasks.filter((t) => t.status === "done");
  const universityProjects = new Set(
    projects.filter((p) => p.category === "University").map((p) => p.name)
  );
  switch (id) {
    case "a1": // First Blood
      return { current: Math.min(done.length, 1), max: 1 };
    case "a2": // Task Slayer
      return { current: done.length, max: 10 };
    case "a3": { // Speed Runner — most quests completed on any single calendar day
      const perDay: Record<string, number> = {};
      for (const t of done) {
        const at = completedAt(t);
        const day = at ? formatLocalDate(at) : undefined;
        if (day) perDay[day] = (perDay[day] ?? 0) + 1;
      }
      const maxPerDay = Math.max(0, ...Object.values(perDay));
      return { current: maxPerDay, max: 5 };
    }
    case "a4": // Bug Hunter
      return { current: done.filter((t) => t.type === "bug").length, max: 50 };
    case "a5": { // Sprint Hero — every quest in the active sprint done
      const active = sprints.find((s) => s.status === "active");
      if (!active) return null;
      const sprintTasks = tasks.filter((t) => t.sprint === active.name);
      if (sprintTasks.length === 0) return null;
      return { current: sprintTasks.filter((t) => t.status === "done").length, max: sprintTasks.length };
    }
    case "a6": // 100 Quests
      return { current: done.length, max: 100 };
    case "a7": // Night Owl — a quest completed 10pm–4am UTC
      return { current: Math.min(done.filter((t) => isCompletedInHourRange(t, 22, 4)).length, 1), max: 1 };
    case "a8": // Morning Hero — a quest completed before 7am UTC
      return { current: Math.min(done.filter((t) => isCompletedInHourRange(t, 0, 7)).length, 1), max: 1 };
    case "a9": // Code Warrior
      return { current: done.filter((t) => t.type === "coding").length, max: 100 };
    case "a10": // Scholar
      return { current: done.filter((t) => universityProjects.has(t.project)).length, max: 50 };
    case "a11": { // Guild Master — the project with the best completion ratio among projects with ≥1 task
      let best: { current: number; max: number } | null = null;
      for (const p of projects) {
        const projectTasks = tasks.filter((t) => t.project === p.name);
        if (projectTasks.length === 0) continue;
        const projectDone = projectTasks.filter((t) => t.status === "done").length;
        if (!best || projectDone / projectTasks.length > best.current / best.max) {
          best = { current: projectDone, max: projectTasks.length };
        }
      }
      return best;
    }
    case "a12": // Perfect Week — 7 consecutive days with a quest completed each day
      return { current: Math.min(calculateLongestStreak(tasks), 7), max: 7 };
    case "a13": // 500 Quests
      return { current: done.length, max: 500 };
    case "a14": // 1000 Quests
      return { current: done.length, max: 1000 };
    default:
      return null;
  }
}

/** Hour-of-day (local) check spanning midnight when `startHour > endHour` — e.g. 22→4 covers 22:00–03:59. */
function isCompletedInHourRange(task: Task, startHour: number, endHour: number): boolean {
  const at = completedAt(task);
  if (!at) return false;
  const hour = new Date(at).getHours();
  return startHour > endHour ? hour >= startHour || hour < endHour : hour >= startHour && hour < endHour;
}

/** Live unlock status per achievement id — replaces the static `unlocked`/`unlockedAt` mock fields. */
export function computeUnlockedAchievements(
  tasks: Task[],
  projects: Project[],
  sprints: Sprint[]
): Record<string, { unlocked: boolean; unlockedAt: string | null }> {
  const done = tasks.filter((t) => t.status === "done");
  const result: Record<string, { unlocked: boolean; unlockedAt: string | null }> = {};

  for (const id of ACHIEVEMENT_IDS) {
    const progress = computeAchievementProgress(id, tasks, projects, sprints);
    const unlocked = progress !== null && progress.max > 0 && progress.current >= progress.max;
    const unlockDate = unlocked ? findUnlockDate(id, done, projects) : null;
    result[id] = { unlocked, unlockedAt: unlockDate ? formatLocalDate(unlockDate) : null };
  }
  return result;
}

function completedAtOf(task: Task | undefined): string | null {
  return task ? completedAt(task) : null;
}

/** Best-effort real timestamp for when an achievement's threshold was actually crossed. */
function findUnlockDate(id: string, done: Task[], projects: Project[]): string | null {
  const sortedByCompletion = [...done].sort((a, b) => (completedAt(a) ?? "").localeCompare(completedAt(b) ?? ""));
  switch (id) {
    case "a1":
      return completedAtOf(sortedByCompletion[0]);
    case "a2":
      return completedAtOf(sortedByCompletion[9]);
    case "a6":
      return completedAtOf(sortedByCompletion[99]);
    case "a13":
      return completedAtOf(sortedByCompletion[499]);
    case "a14":
      return completedAtOf(sortedByCompletion[999]);
    case "a4": {
      const bugs = sortedByCompletion.filter((t) => t.type === "bug");
      return completedAtOf(bugs[49]);
    }
    case "a9": {
      const coding = sortedByCompletion.filter((t) => t.type === "coding");
      return completedAtOf(coding[99]);
    }
    case "a10": {
      const universityProjects = new Set(projects.filter((p) => p.category === "University").map((p) => p.name));
      const uni = sortedByCompletion.filter((t) => universityProjects.has(t.project));
      return completedAtOf(uni[49]);
    }
    case "a7":
      return completedAtOf(sortedByCompletion.find((t) => isCompletedInHourRange(t, 22, 4)));
    case "a8":
      return completedAtOf(sortedByCompletion.find((t) => isCompletedInHourRange(t, 0, 7)));
    case "a3": {
      const perDay: Record<string, string[]> = {};
      for (const t of sortedByCompletion) {
        const at = completedAt(t);
        const day = at ? formatLocalDate(at) : null;
        if (day && at) (perDay[day] ??= []).push(at);
      }
      const bestDay = Object.values(perDay).sort((a, b) => b.length - a.length)[0];
      return bestDay?.at(-1) ?? null;
    }
    case "a5":
    case "a11":
    case "a12":
      // Sprint/project completion and streak-length unlocks aren't tied to one specific task;
      // the most recent completion overall is a reasonable proxy for "just now".
      return completedAtOf(sortedByCompletion.at(-1));
    default:
      return null;
  }
}

export function formatLocalDate(dateInput: Date | string): string {
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function calculateStreak(tasks: Task[], nowStr?: string): number {
  const doneTasks = tasks.filter((t) => t.status === "done");
  const completionDates = new Set<string>();
  for (const t of doneTasks) {
    const at = completedAt(t);
    if (at) {
      completionDates.add(formatLocalDate(at));
    }
  }

  if (completionDates.size === 0) return 0;

  const today = nowStr ? new Date(nowStr) : new Date();
  const todayStr = formatLocalDate(today);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatLocalDate(yesterday);

  if (!completionDates.has(todayStr) && !completionDates.has(yesterdayStr)) {
    return 0;
  }

  const current = parseLocalDate(completionDates.has(todayStr) ? todayStr : yesterdayStr);
  let streak = 0;

  while (true) {
    const dateStr = formatLocalDate(current);
    if (completionDates.has(dateStr)) {
      streak++;
      current.setDate(current.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

/** Longest-ever run of consecutive calendar days with at least one completed task — docs/01-product.md §9.7. */
export function calculateLongestStreak(tasks: Task[]): number {
  const doneTasks = tasks.filter((t) => t.status === "done");
  const completionDates = new Set<string>();
  for (const t of doneTasks) {
    const at = completedAt(t);
    if (at) completionDates.add(formatLocalDate(at));
  }
  if (completionDates.size === 0) return 0;

  const sortedDates = Array.from(completionDates).sort();
  let longest = 1;
  let current = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    const prev = parseLocalDate(sortedDates[i - 1]);
    const next = parseLocalDate(sortedDates[i]);
    const dayGap = Math.round((next.getTime() - prev.getTime()) / 86_400_000);
    current = dayGap === 1 ? current + 1 : 1;
    longest = Math.max(longest, current);
  }
  return longest;
}

/**
 * Calculate XP reward for a note based on word count.
 * Base: 1 XP per 50 words (rounded down)
 * Bonus: +2 XP if daily streak active
 */
export function calculateNoteXP(wordCount: number, hasStreak: boolean = false): number {
  const baseXP = Math.floor(wordCount / 50);
  const streakBonus = hasStreak ? 2 : 0;
  return Math.max(1, baseXP + streakBonus);
}

/**
 * Achievement unlock checks for notes.
 * Returns list of newly unlocked achievements.
 */
export function checkNoteAchievements(
  totalNotes: number,
  totalWords: number
): string[] {
  const unlocked: string[] = [];

  if (totalNotes === 1 && totalWords >= 50) {
    unlocked.push("Scribe I");
  }
  if (totalNotes >= 10 && totalWords >= 500) {
    unlocked.push("Scribe II");
  }
  if (totalNotes >= 50 && totalWords >= 5000) {
    unlocked.push("Scribe III");
  }

  return unlocked;
}

/**
 * Check if user leveled up and emit notification if so.
 * Compare old XP level to new XP level.
 */
export function checkAndEmitLevelUp(oldXp: number, newXp: number): void {
  const oldLevel = getLevelInfo(oldXp).level;
  const newLevel = getLevelInfo(newXp).level;

  if (newLevel > oldLevel) {
    notificationEmitter.emit({
      type: 'gamification:level-up',
      newLevel,
      xp: newXp,
    });
  }
}

/**
 * Check if achievements were unlocked and emit notifications.
 * Compare old achievement states to new achievement states.
 */
export function checkAndEmitAchievementUnlocks(
  oldAchievements: Record<string, { unlocked: boolean; unlockedAt: string | null }>,
  newAchievements: Record<string, { unlocked: boolean; unlockedAt: string | null }>
): void {
  const ACHIEVEMENT_NAMES: Record<string, string> = {
    a1: "First Blood",
    a2: "Task Slayer",
    a3: "Speed Runner",
    a4: "Bug Hunter",
    a5: "Sprint Hero",
    a6: "100 Quests",
    a7: "Night Owl",
    a8: "Morning Hero",
    a9: "Code Warrior",
    a10: "Scholar",
    a11: "Guild Master",
    a12: "Perfect Week",
    a13: "500 Quests",
    a14: "1000 Quests",
  };

  for (const achievementId of ACHIEVEMENT_IDS) {
    const wasUnlocked = oldAchievements[achievementId]?.unlocked ?? false;
    const isNowUnlocked = newAchievements[achievementId]?.unlocked ?? false;

    if (!wasUnlocked && isNowUnlocked) {
      notificationEmitter.emit({
        type: 'gamification:achievement-unlocked',
        achievementId,
        name: ACHIEVEMENT_NAMES[achievementId] || achievementId,
      });
    }
  }
}

/**
 * Check if streak reached a milestone (7, 14, or 30 days) and emit notification.
 */
export function checkAndEmitStreakMilestone(oldStreak: number, newStreak: number): void {
  const milestones = [7, 14, 30];

  for (const milestone of milestones) {
    // Check if streak just reached this milestone
    if (oldStreak < milestone && newStreak >= milestone) {
      const vibe = getStreakVibe(newStreak).label;
      notificationEmitter.emit({
        type: 'gamification:streak-milestone',
        days: newStreak,
        vibe,
      });
    }
  }
}

/**
 * Proactive overdue/due-soon nudge — docs/01-product.md §9.4 dashboard counts show these,
 * but nothing previously pinged the notification queue about them (docs/05-backlog.md §6).
 * Picks the single most urgent task per category rather than one toast per task, since the
 * notification queue only holds 5 at a time and a to-do app shouldn't spam on every load.
 */
export function checkAndEmitDueDateNotifications(tasks: Task[], today: string): void {
  const active = tasks.filter((t) => t.status !== "done");

  const overdue = active
    .filter((t) => isOverdue(t.dueDate, today))
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  if (overdue.length > 0) {
    const [first, ...rest] = overdue;
    notificationEmitter.emit({
      type: 'task:overdue',
      taskId: first.id,
      title: rest.length > 0 ? `${first.title} (+${rest.length} more overdue)` : first.title,
    });
  }

  const dueSoon = active
    .filter((t) => isDueSoon(t.dueDate, today))
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  if (dueSoon.length > 0) {
    const [first, ...rest] = dueSoon;
    notificationEmitter.emit({
      type: 'task:due-soon',
      taskId: first.id,
      title: rest.length > 0 ? `${first.title} (+${rest.length} more due soon)` : first.title,
      dueDate: first.dueDate!,
    });
  }
}
