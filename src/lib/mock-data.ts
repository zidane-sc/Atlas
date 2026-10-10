import type { Priority, Task, TaskStatus, TaskType } from "@/types/task";
import type { Achievement, Project, Sprint } from "@/types/gamification";

export const STATUS_LABEL: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "Todo",
  in_progress: "In Progress",
  done: "Done",
  archived: "Archived",
};

export const STATUS_COLOR_VAR: Record<TaskStatus, string> = {
  backlog: "--color-status-inbox",
  todo: "--color-status-inbox",
  in_progress: "--color-status-in-progress",
  done: "--color-status-done",
  archived: "--color-text-muted",
};

/** Status shape glyph, so status also survives grayscale/colorblind viewing — docs/03-design.md §8 */
export const STATUS_SHAPE: Record<TaskStatus, string> = {
  backlog: "▣",
  todo: "□",
  in_progress: "▶",
  done: "✓",
  archived: "□",
};

export const KANBAN_COLUMNS: TaskStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "done",
  "archived",
];

export const PRIORITY_LABEL: Record<Priority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const PRIORITY_COLOR_VAR: Record<Priority, string> = {
  high: "--color-priority-p0",
  medium: "--color-priority-p2",
  low: "--color-priority-p4",
};

/** High=square, Medium=circle, Low=dot — docs/03-design.md §8 */
export const PRIORITY_SHAPE: Record<Priority, "square" | "circle" | "dot"> = {
  high: "square",
  medium: "circle",
  low: "dot",
};

export const TYPE_ICON: Record<TaskType, string> = {
  coding: "💻",
  research: "🔍",
  design: "🎨",
  documentation: "📝",
  bug: "🐞",
  meeting: "👥",
  admin: "⚙️",
};

/** Project totals are computed live from tasks on each page (see useTasks()), not stored here. */
export const mockProjects: Project[] = [
  { id: "p1", name: "My Full-Time Job", colorVar: "--color-priority-p0", emoji: "🏢", category: "work", description: "Work tasks — rename to your actual job", status: "active" },
  { id: "p2", name: "University Courses", colorVar: "--color-status-waiting-external", emoji: "🎓", category: "learning", description: "Study and coursework — rename to your school", status: "active" },
  { id: "p3", name: "Personal Side Project", colorVar: "--color-status-ready", emoji: "🚀", category: "personal", description: "My side project — rename to your project", status: "active" },
];

// Sprint removed - keeping empty array for compatibility
export const mockSprints: Sprint[] = [];

/** Achievement categories — docs/03-design.md §11.7 */
export const mockAchievements: Achievement[] = [
  { id: "a1", name: "First Blood", description: "Complete your first quest", icon: "⚔", category: "combat", xp: 50, unlocked: true, unlockedAt: "2026-07-14" },
  { id: "a2", name: "Task Slayer", description: "Complete 10 quests total", icon: "🗡", category: "combat", xp: 100, unlocked: true, unlockedAt: "2026-07-22" },
  { id: "a3", name: "Speed Runner", description: "Complete 5 quests in a single day", icon: "⚡", category: "combat", xp: 200, unlocked: false, unlockedAt: null },
  { id: "a4", name: "Bug Hunter", description: "Complete 50 quests of type Bug", icon: "🐞", category: "combat", xp: 300, unlocked: false, unlockedAt: null },
  { id: "a5", name: "Project Hero", description: "Complete every quest in an active project", icon: "🏆", category: "combat", xp: 400, unlocked: false, unlockedAt: null },
  { id: "a6", name: "100 Quests", description: "Complete 100 quests total", icon: "💎", category: "combat", xp: 300, unlocked: false, unlockedAt: null },
  { id: "a7", name: "Night Owl", description: "Complete a quest between 10pm–4am", icon: "🦉", category: "exploration", xp: 75, unlocked: true, unlockedAt: "2026-07-17" },
  { id: "a8", name: "Morning Hero", description: "Complete a quest before 7am", icon: "🌅", category: "exploration", xp: 75, unlocked: false, unlockedAt: null },
  { id: "a9", name: "Code Warrior", description: "Complete 100 quests of type Coding", icon: "💻", category: "crafting", xp: 500, unlocked: false, unlockedAt: null },
  { id: "a10", name: "Scholar", description: "Complete 50 quests in a Learning project", icon: "📚", category: "crafting", xp: 300, unlocked: false, unlockedAt: null },
  { id: "a11", name: "Project Master", description: "Complete an entire project", icon: "🛡", category: "social", xp: 500, unlocked: false, unlockedAt: null },
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
  { label: "Finish a High priority quest", icon: "🎯", goal: 1, xp: 120, coins: 8, matches: (t) => t.priority === "high" },
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
