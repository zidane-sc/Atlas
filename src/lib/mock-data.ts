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

export const mockTasks: Task[] = [
  {
    id: "t1",
    title: "Investigate checkout 500 on mobile",
    description: "Users report a 500 error submitting checkout on iOS Safari only.",
    project: "ATS",
    status: "in_progress",
    type: "investigation",
    priority: "p0",
    effort: "m",
    storyPoint: 3,
    dueDate: "2026-07-30",
    sprint: "Sprint 7 — The Awakening",
    tags: ["bug", "mobile"],
    relations: [{ relationType: "generated_from", taskId: "t9", title: "QA report #482" }],
    attachments: [{ type: "slack", label: "QA thread", url: "#" }],
    deliverables: [],
    statusHistory: [
      { fromStatus: null, toStatus: "inbox", changedAt: "2026-07-27T09:00:00Z" },
      { fromStatus: "inbox", toStatus: "ready", changedAt: "2026-07-27T10:00:00Z" },
      { fromStatus: "ready", toStatus: "in_progress", changedAt: "2026-07-28T09:00:00Z" },
    ],
  },
  {
    id: "t2",
    title: "Fix checkout 500 (child of investigation)",
    project: "ATS",
    status: "blocked",
    type: "bug",
    priority: "p0",
    effort: "l",
    storyPoint: 5,
    waitingOn: "DBA backup check",
    sprint: "Sprint 7 — The Awakening",
    tags: ["bug"],
    relations: [{ relationType: "caused_by", taskId: "t1", title: "Investigate checkout 500 on mobile" }],
    attachments: [],
    deliverables: [],
    statusHistory: [{ fromStatus: null, toStatus: "blocked", changedAt: "2026-07-28T11:00:00Z" }],
  },
  {
    id: "t3",
    title: "Write thesis chapter 3 draft",
    project: "Thesis",
    status: "todo",
    type: "documentation",
    priority: "p2",
    effort: "xl",
    storyPoint: 8,
    dueDate: "2026-08-05",
    tags: ["thesis", "writing"],
    relations: [],
    attachments: [],
    deliverables: [],
    statusHistory: [{ fromStatus: null, toStatus: "todo", changedAt: "2026-07-20T09:00:00Z" }],
  },
  {
    id: "t4",
    title: "Client A — landing page revisions",
    project: "Client A",
    status: "waiting_external",
    type: "design",
    priority: "p1",
    effort: "s",
    storyPoint: 2,
    waitingOn: "Client A — feedback on Figma v3",
    tags: ["design", "client"],
    relations: [],
    attachments: [{ type: "figma", label: "Landing v3", url: "#" }],
    deliverables: [{ type: "design", label: "Figma v3" }],
    statusHistory: [{ fromStatus: "in_progress", toStatus: "waiting_external", changedAt: "2026-07-25T15:00:00Z" }],
  },
  {
    id: "t5",
    title: "Deploy Atlas v0.1 to Vercel",
    project: "Atlas",
    status: "ready",
    type: "deployment",
    priority: "p2",
    effort: "xs",
    storyPoint: 1,
    tags: ["devops"],
    relations: [],
    attachments: [],
    deliverables: [],
    statusHistory: [{ fromStatus: null, toStatus: "ready", changedAt: "2026-07-29T08:00:00Z" }],
  },
  {
    id: "t6",
    title: "Sprint planning meeting notes",
    project: "Full-time",
    status: "done",
    type: "meeting",
    priority: "p3",
    effort: "xs",
    storyPoint: 1,
    tags: ["meeting"],
    relations: [],
    attachments: [],
    deliverables: [{ type: "meeting_notes", label: "Notes" }],
    statusHistory: [
      { fromStatus: "in_progress", toStatus: "testing", changedAt: "2026-07-26T10:00:00Z" },
      { fromStatus: "testing", toStatus: "done", changedAt: "2026-07-26T10:30:00Z" },
    ],
  },
  {
    id: "t7",
    title: "Group project — capture raw notes",
    project: "Group Project",
    status: "inbox",
    type: "research",
    priority: "p4",
    tags: ["idea"],
    relations: [],
    attachments: [],
    deliverables: [],
    statusHistory: [{ fromStatus: null, toStatus: "inbox", changedAt: "2026-07-29T07:00:00Z" }],
  },
  {
    id: "t8",
    title: "QA regression pass on release branch",
    project: "ATS",
    status: "testing",
    type: "testing",
    priority: "p1",
    effort: "m",
    storyPoint: 3,
    sprint: "Sprint 7 — The Awakening",
    tags: ["qa", "testing"],
    relations: [],
    attachments: [{ type: "github_pr", label: "PR #214", url: "#" }],
    deliverables: [],
    statusHistory: [{ fromStatus: "in_progress", toStatus: "testing", changedAt: "2026-07-28T16:00:00Z" }],
  },
  // Completed tasks below feed the Character Sheet's skill/stat derivation (docs/03-design.md §11.8)
  {
    id: "t9",
    title: "JWT auth (access + refresh tokens)",
    project: "ATS",
    status: "done",
    type: "coding",
    priority: "p0",
    effort: "l",
    storyPoint: 5,
    sprint: "Sprint 6 — Dark Passage",
    tags: ["auth", "security"],
    relations: [],
    attachments: [],
    deliverables: [{ type: "pr", label: "PR #198" }],
    statusHistory: [{ fromStatus: "in_progress", toStatus: "done", changedAt: "2026-07-17T12:00:00Z" }],
  },
  {
    id: "t10",
    title: "Full-text search endpoint",
    project: "Atlas",
    status: "done",
    type: "coding",
    priority: "p1",
    effort: "xl",
    storyPoint: 8,
    sprint: "Sprint 7 — The Awakening",
    tags: ["search"],
    relations: [],
    attachments: [],
    deliverables: [{ type: "pr", label: "PR #201" }],
    statusHistory: [{ fromStatus: "ready", toStatus: "done", changedAt: "2026-07-21T09:00:00Z" }],
  },
  {
    id: "t11",
    title: "Fix session-invalidation auth bypass",
    project: "ATS",
    status: "done",
    type: "bug",
    priority: "p0",
    effort: "m",
    storyPoint: 3,
    sprint: "Sprint 6 — Dark Passage",
    tags: ["security", "auth"],
    relations: [],
    attachments: [],
    deliverables: [{ type: "pr", label: "PR #204" }],
    statusHistory: [{ fromStatus: "in_progress", toStatus: "done", changedAt: "2026-07-22T14:00:00Z" }],
  },
  {
    id: "t12",
    title: "E2E checkout regression suite",
    project: "Client A",
    status: "done",
    type: "testing",
    priority: "p1",
    effort: "m",
    storyPoint: 3,
    sprint: "Sprint 6 — Dark Passage",
    tags: ["testing", "e2e"],
    relations: [],
    attachments: [],
    deliverables: [],
    statusHistory: [{ fromStatus: "testing", toStatus: "done", changedAt: "2026-07-19T10:00:00Z" }],
  },
  {
    id: "t13",
    title: "Candidate pipeline UI redesign",
    project: "ATS",
    status: "done",
    type: "design",
    priority: "p2",
    effort: "s",
    storyPoint: 2,
    sprint: "Sprint 6 — Dark Passage",
    tags: ["design", "ui"],
    relations: [],
    attachments: [{ type: "figma", label: "Pipeline v2", url: "#" }],
    deliverables: [{ type: "design", label: "Figma v2" }],
    statusHistory: [{ fromStatus: "waiting_external", toStatus: "done", changedAt: "2026-07-15T11:00:00Z" }],
  },
  {
    id: "t14",
    title: "Survey distributed consensus literature",
    project: "Thesis",
    status: "done",
    type: "research",
    priority: "p2",
    effort: "l",
    storyPoint: 5,
    sprint: "Sprint 6 — Dark Passage",
    tags: ["research"],
    relations: [],
    attachments: [],
    deliverables: [{ type: "research", label: "Lit review doc" }],
    statusHistory: [{ fromStatus: "todo", toStatus: "done", changedAt: "2026-07-14T09:00:00Z" }],
  },
  {
    id: "t15",
    title: "REST API docs (OpenAPI 3.1)",
    project: "ATS",
    status: "done",
    type: "documentation",
    priority: "p2",
    effort: "m",
    storyPoint: 3,
    sprint: "Sprint 6 — Dark Passage",
    tags: ["docs", "api"],
    relations: [],
    attachments: [],
    deliverables: [{ type: "confluence", label: "API docs page" }],
    statusHistory: [{ fromStatus: "in_progress", toStatus: "done", changedAt: "2026-07-19T15:00:00Z" }],
  },
  {
    id: "t16",
    title: "Slow reporting query analysis",
    project: "ATS",
    status: "done",
    type: "analysis",
    priority: "p1",
    effort: "m",
    storyPoint: 3,
    sprint: "Sprint 7 — The Awakening",
    tags: ["performance", "sql"],
    relations: [],
    attachments: [],
    deliverables: [],
    statusHistory: [{ fromStatus: "ready", toStatus: "done", changedAt: "2026-07-24T13:00:00Z" }],
  },
];

/** Project totals are computed live from tasks on each page (see useTasks()), not stored here. */
export const mockProjects: Project[] = [
  { id: "p1", name: "ATS", colorVar: "--color-priority-p0", emoji: "🏢", category: "Full-time", description: "Applicant Tracking System — squad lead", status: "active" },
  { id: "p2", name: "Thesis", colorVar: "--color-status-waiting-external", emoji: "🎓", category: "University", description: "Distributed systems thesis", status: "active" },
  { id: "p3", name: "Client A", colorVar: "--color-status-in-progress", emoji: "💼", category: "Freelance", description: "Freelance client work", status: "active" },
  { id: "p4", name: "Atlas", colorVar: "--color-status-ready", emoji: "🚀", category: "Side Project", description: "This app — personal second brain", status: "active" },
  { id: "p5", name: "Group Project", colorVar: "--color-status-testing", emoji: "🎓", category: "University", description: "University group project", status: "active" },
  { id: "p6", name: "Full-time", colorVar: "--color-text-muted", emoji: "🏢", category: "Full-time", description: "General full-time job tasks", status: "active" },
];

export const mockSprints: Sprint[] = [
  {
    id: "s1",
    name: "Sprint 7 — The Awakening",
    startDate: "2026-07-21",
    endDate: "2026-08-03",
    status: "active",
    goal: "Ship search endpoint, patch auth bypass, clear QA regression.",
  },
  {
    id: "s2",
    name: "Sprint 6 — Dark Passage",
    startDate: "2026-07-07",
    endDate: "2026-07-20",
    status: "completed",
    goal: "Auth, design pass, docs, and first thesis literature review.",
  },
  {
    id: "s3",
    name: "Sprint 8 — The Reckoning",
    startDate: "2026-08-04",
    endDate: "2026-08-17",
    status: "planning",
    goal: "Onboarding flow, thesis chapter 3 draft.",
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
  { id: "a12", name: "Perfect Week", description: "7 consecutive Perfect Days", icon: "🌟", category: "social", xp: 700, unlocked: false, unlockedAt: null },
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

/** Fixed reference "now" so recap/statistics windows line up with the authored mock dates. */
export const MOCK_NOW = "2026-07-29";

export const todaysDailyQuest = DAILY_QUEST_POOL[new Date(MOCK_NOW).getDate() % DAILY_QUEST_POOL.length];

/**
 * Level/XP/coins are now derived live from real task completions via `computeCharacterSheet`
 * (see src/lib/gamification.ts) — streak is the one field still seeded here, since it needs
 * cross-session calendar-day tracking this client-side, reload-resetting mock can't provide.
 */
export const dashboardMock = {
  streakDays: 9,
};
