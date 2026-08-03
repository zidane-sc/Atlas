import type { Priority, Task, TaskStatus, TaskType } from "@/types/task";
import type { Achievement, Project, Sprint } from "@/types/gamification";

export const STATUS_LABEL: Record<TaskStatus, string> = {
  inbox: "Inbox",
  todo: "Todo",
  ready: "Ready",
  in_progress: "In Progress",
  blocked: "Blocked",
  waiting_external: "Waiting Ext.",
  testing: "Testing",
  done: "Done",
};

export const STATUS_COLOR_VAR: Record<TaskStatus, string> = {
  inbox: "--color-status-inbox",
  todo: "--color-status-inbox",
  ready: "--color-status-ready",
  in_progress: "--color-status-in-progress",
  blocked: "--color-status-blocked",
  waiting_external: "--color-status-waiting-external",
  testing: "--color-status-testing",
  done: "--color-status-done",
};

/** Status shape glyph, so status also survives grayscale/colorblind viewing — docs/03-design.md §8 */
export const STATUS_SHAPE: Record<TaskStatus, string> = {
  inbox: "▣",
  todo: "□",
  ready: "◈",
  in_progress: "▶",
  blocked: "✕",
  waiting_external: "⏸",
  testing: "◆",
  done: "✓",
};

export const KANBAN_COLUMNS: TaskStatus[] = [
  "inbox",
  "todo",
  "ready",
  "in_progress",
  "blocked",
  "waiting_external",
  "testing",
  "done",
];

export const PRIORITY_LABEL: Record<Priority, string> = {
  p0: "P0 Critical",
  p1: "P1 High",
  p2: "P2 Normal",
  p3: "P3 Low",
  p4: "P4 Someday",
};

export const PRIORITY_COLOR_VAR: Record<Priority, string> = {
  p0: "--color-priority-p0",
  p1: "--color-priority-p1",
  p2: "--color-priority-p2",
  p3: "--color-priority-p3",
  p4: "--color-priority-p4",
};

/** P0=square, P1=triangle, P2=circle, P3=outline circle, P4=dot — docs/03-design.md §8 */
export const PRIORITY_SHAPE: Record<Priority, "square" | "triangle" | "circle" | "circle-outline" | "dot"> = {
  p0: "square",
  p1: "triangle",
  p2: "circle",
  p3: "circle-outline",
  p4: "dot",
};

export const TYPE_ICON: Record<TaskType, string> = {
  coding: "💻",
  investigation: "🔍",
  study: "📖",
  analysis: "📊",
  documentation: "📝",
  bug: "🐞",
  deployment: "🚀",
  testing: "🧪",
  meeting: "👥",
  research: "💡",
  design: "🎨",
  maintenance: "⚙️",
  refactor: "📦",
  incident: "🔥",
  communication: "📞",
};

/** Project totals are computed live from tasks on each page (see useTasks()), not stored here. */
export const mockProjects: Project[] = [
  { id: "p1", name: "My Full-Time Job", colorVar: "--color-priority-p0", emoji: "🏢", category: "Full-time", description: "Work tasks — rename to your actual job", status: "active" },
  { id: "p2", name: "University Courses", colorVar: "--color-status-waiting-external", emoji: "🎓", category: "University", description: "Study and coursework — rename to your school", status: "active" },
  { id: "p3", name: "Personal Side Project", colorVar: "--color-status-ready", emoji: "🚀", category: "Side Project", description: "My side project — rename to your project", status: "active" },
];

export const mockSprints: Sprint[] = [
  {
    id: "s1",
    name: "Current Sprint",
    projectId: "p3",
    startDate: "2026-08-03",
    endDate: "2026-08-17",
    status: "active",
    goal: "Rename this sprint and set your goals",
  },
];

/** Achievement categories — docs/03-design.md §11.7 */
export const mockAchievements: Achievement[] = [
  { id: "a1", name: "First Blood", description: "Complete your first quest", icon: "⚔", category: "combat", xp: 50, unlocked: true, unlockedAt: "2026-07-14" },
  { id: "a2", name: "Task Slayer", description: "Complete 10 quests total", icon: "🗡", category: "combat", xp: 100, unlocked: true, unlockedAt: "2026-07-22" },
  { id: "a3", name: "Speed Runner", description: "Complete 5 quests in a single day", icon: "⚡", category: "combat", xp: 200, unlocked: false, unlockedAt: null },
  { id: "a4", name: "Bug Hunter", description: "Complete 50 quests of type Bug", icon: "🐞", category: "combat", xp: 300, unlocked: false, unlockedAt: null },
  { id: "a5", name: "Sprint Hero", description: "Complete every quest in an active sprint", icon: "🏆", category: "combat", xp: 400, unlocked: false, unlockedAt: null },
  { id: "a6", name: "100 Quests", description: "Complete 100 quests total", icon: "💎", category: "combat", xp: 300, unlocked: false, unlockedAt: null },
  { id: "a7", name: "Night Owl", description: "Complete a quest between 10pm–4am", icon: "🦉", category: "exploration", xp: 75, unlocked: true, unlockedAt: "2026-07-17" },
  { id: "a8", name: "Morning Hero", description: "Complete a quest before 7am", icon: "🌅", category: "exploration", xp: 75, unlocked: false, unlockedAt: null },
  { id: "a9", name: "Code Warrior", description: "Complete 100 quests of type Coding", icon: "💻", category: "crafting", xp: 500, unlocked: false, unlockedAt: null },
  { id: "a10", name: "Scholar", description: "Complete 50 quests in a University project", icon: "📚", category: "crafting", xp: 300, unlocked: false, unlockedAt: null },
  { id: "a11", name: "Guild Master", description: "Complete an entire project", icon: "🛡", category: "social", xp: 500, unlocked: false, unlockedAt: null },
  { id: "a12", name: "Perfect Week", description: "Complete at least one quest on 7 consecutive days", icon: "🌟", category: "social", xp: 700, unlocked: false, unlockedAt: null },
  { id: "a13", name: "500 Quests", description: "Complete 500 quests total", icon: "🏅", category: "combat", xp: 800, unlocked: false, unlockedAt: null },
  { id: "a14", name: "1000 Quests", description: "Complete 1000 quests total", icon: "👑", category: "combat", xp: 1500, unlocked: false, unlockedAt: null },
];

/** Rotating daily quest templates — docs/01-product.md §9.6 (one auto-selected per day). */
export const DAILY_QUEST_POOL: {
  label: string;
  icon: string;
  goal: number;
  xp: number;
  coins: number;
  matches: (t: Task) => boolean;
}[] = [
  { label: "Complete 3 quests today", icon: "⚔", goal: 3, xp: 80, coins: 5, matches: () => true },
  { label: "Finish a P0 Critical quest", icon: "🎯", goal: 1, xp: 120, coins: 8, matches: (t) => t.priority === "p0" },
  { label: "Complete a Bug quest", icon: "🐞", goal: 1, xp: 90, coins: 6, matches: (t) => t.type === "bug" },
  { label: "Conquer 5 quests today", icon: "💫", goal: 5, xp: 150, coins: 10, matches: () => true },
  { label: "Complete a tagged quest", icon: "🏷", goal: 1, xp: 90, coins: 6, matches: (t) => t.tags.length > 0 },
];

/** Get today's date in YYYY-MM-DD format. */
export function getTodayDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export const MOCK_NOW = getTodayDate();

export const todaysDailyQuest = DAILY_QUEST_POOL[new Date(MOCK_NOW).getDate() % DAILY_QUEST_POOL.length];
