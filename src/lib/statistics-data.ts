import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { mapDbTaskToClient, mapDbProjectToClient } from "@/lib/tasks-reducer";
import {
  calcTaskXP,
  completedAt,
  computeRecapGrade,
  createdAt,
  isTaskOnTime,
  calculateStreak,
  calculateLongestStreak,
  parseLocalDate,
} from "@/lib/gamification";
import {
  buildProductivityProfile,
  calcAverageTaskDurationDays,
  calcCompletionRate,
  calcEstimatedVsActualStoryPoints,
  calcFocusHours,
  type ProductivityProfile,
  type StoryPointComparison,
} from "@/lib/statistics";
import { TYPE_ICON } from "@/lib/mock-data";
import type { RecapData } from "@/components/gamification/RecapCutscene";
import type { Priority, Task, TaskType } from "@/types/task";
import type { Project } from "@/types/gamification";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Reference's fixed per-row bar-chart palette for "By Type" — mirrors CHART_COLORS
 * in StatisticsContent.tsx, kept here too since `byType`'s ordering is computed server-side. */
const CHART_COLORS = {
  red: "#e94560",
  yellow: "#f6c90e",
  ready: "#4ecca3",
  violet: "#a29bfe",
  cyan: "#00b8d9",
  textMuted: "#6b7483",
  dim: "#3a3f50",
};

export interface StatisticsData {
  /** Lean (no statusHistory/comments) full task list — only used by <ActivityHeatmap>,
   * which does its own memoized grid build + interactive hover tooltip client-side. */
  tasks: Task[];
  nowAnchor: string;
  weekly: RecapData;
  monthly: RecapData;
  weeklyThroughput: { day: string; done: number; prevDone: number }[];
  kpis: { label: string; value: number; colorVar: string }[];
  byPriority: { key: Priority; label: string; value: number; fill: string }[];
  byType: { type: TaskType; value: number }[];
  byProject: { name: string; done: number; active: number; total: number; colorVar: string }[];
  productivityProfile: ProductivityProfile;
  completionRate: number;
  avgTaskDurationDays: number | null;
  focusHours: number;
  longestStreak: number;
  storyPointComparison: StoryPointComparison;
  doneThisWeekCount: number;
  weeklyStoryPointComparison: StoryPointComparison;
  wow: { label: string; icon: string; now: number; prev: number }[];
}

function buildWeeklyThroughput(tasks: Task[], nowStr: string): { day: string; done: number; prevDone: number }[] {
  const DAY_MS = 86_400_000;
  const now = parseLocalDate(nowStr).getTime();
  const countInRange = (start: number, end: number) =>
    tasks.filter((t) => {
      const c = completedAt(t);
      if (!c) return false;
      const ct = new Date(c).getTime();
      return ct >= start && ct < end;
    }).length;

  const buckets: { day: string; done: number; prevDone: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = now - i * DAY_MS;
    const dayEnd = dayStart + DAY_MS;
    buckets.push({
      day: WEEKDAY_LABELS[new Date(dayStart).getDay()],
      done: countInRange(dayStart, dayEnd),
      prevDone: countInRange(dayStart - 7 * DAY_MS, dayEnd - 7 * DAY_MS),
    });
  }
  return buckets;
}

function buildRecap(allTasks: Task[], projects: Project[], periodDays: number, period: "week" | "month", now: number): RecapData {
  const day = 86_400_000;
  const from = now - periodDays * day;
  const prevFrom = now - periodDays * 2 * day;

  const doneInRange = (start: number, end: number) =>
    allTasks.filter((t) => {
      const c = completedAt(t);
      if (!c) return false;
      const ct = new Date(c).getTime();
      return ct >= start && ct < end;
    });

  const doneThis = doneInRange(from, now);
  const donePrev = doneInRange(prevFrom, from);
  const created = allTasks.filter((t) => {
    const c = createdAt(t);
    return c != null && new Date(c).getTime() >= from;
  }).length;
  const prevCreated = allTasks.filter((t) => {
    const c = createdAt(t);
    if (c == null) return false;
    const ct = new Date(c).getTime();
    return ct >= prevFrom && ct < from;
  }).length;
  const xpEarned = doneThis.reduce((sum, t) => sum + calcTaskXP(t.priority, t.storyPoint, isTaskOnTime(t)), 0);
  const completedByProject = projects.map((p) => ({
    project: p,
    completed: allTasks.filter((t) => t.project === p.name && t.status === "done").length,
  }));
  const topProject = completedByProject.length > 0
    ? completedByProject.reduce((best, p) => (p.completed > best.completed ? p : best)).project
    : null;

  return {
    period,
    done: doneThis.length,
    prevDone: donePrev.length,
    created,
    prevCreated,
    xpEarned,
    streak: calculateStreak(allTasks),
    topProject: topProject ? { name: topProject.name, emoji: topProject.emoji, colorVar: topProject.colorVar } : null,
    grade: computeRecapGrade(doneThis.length, created),
  };
}

export async function getStatisticsPageData(): Promise<StatisticsData | null> {
  const session = await auth();
  if (!session?.user?.email) return null;

  const owner = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
  if (!owner) return null;

  const [dbTasks, dbProjects] = await Promise.all([
    db.task.findMany({ where: { ownerId: owner.id, deletedAt: null } }),
    db.project.findMany({ where: { archivedAt: null } }),
  ]);

  const tasks = dbTasks.map((t) => mapDbTaskToClient(t, dbProjects));
  const projects = dbProjects.map(mapDbProjectToClient);

  const doneTasks = tasks.filter((t) => completedAt(t) != null);
  const latestCompletion = doneTasks.length > 0
    ? Math.max(...doneTasks.map((t) => new Date(completedAt(t)!).getTime()))
    : 0;
  const nowTime = Math.max(Date.now(), latestCompletion);
  const nowAnchor = new Date(nowTime).toISOString().slice(0, 10);

  const kpis = [
    { label: "TOTAL", value: tasks.length, colorVar: "--color-text-primary" },
    { label: "DONE", value: tasks.filter((t) => t.status === "done").length, colorVar: "--color-status-done" },
    { label: "ACTIVE", value: tasks.filter((t) => t.status === "in_progress").length, colorVar: "--color-status-in-progress" },
    { label: "WAITING", value: tasks.filter((t) => t.status === "waiting_external").length, colorVar: "--color-status-waiting-external" },
  ];

  const PRIORITY_FILL: Record<Priority, string> = {
    p0: CHART_COLORS.red,
    p1: CHART_COLORS.yellow,
    p2: CHART_COLORS.ready,
    p3: CHART_COLORS.textMuted,
    p4: CHART_COLORS.dim,
  };
  const byPriority = (["p0", "p1", "p2", "p3", "p4"] as Priority[]).map((p) => ({
    key: p,
    label: p.toUpperCase(),
    value: tasks.filter((t) => t.priority === p).length,
    fill: PRIORITY_FILL[p],
  }));

  const byType = (Object.keys(TYPE_ICON) as TaskType[])
    .map((type) => ({ type, value: tasks.filter((t) => t.type === type).length }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const byProject = projects
    .map((p) => {
      const projectTasks = tasks.filter((t) => t.project === p.name);
      const done = projectTasks.filter((t) => t.status === "done").length;
      return { name: p.name.split(" ")[0], done, active: projectTasks.length - done, total: projectTasks.length, colorVar: p.colorVar };
    })
    .filter((p) => p.total > 0);

  const weekly = buildRecap(tasks, projects, 7, "week", nowTime);
  const monthly = buildRecap(tasks, projects, 30, "month", nowTime);
  const weeklyThroughput = buildWeeklyThroughput(tasks, nowAnchor);

  const productivityProfile = buildProductivityProfile(tasks);
  const completionRate = calcCompletionRate(tasks);
  const avgTaskDurationDays = calcAverageTaskDurationDays(tasks);
  const focusHours = calcFocusHours(tasks);
  const longestStreak = calculateLongestStreak(tasks);
  const storyPointComparison = calcEstimatedVsActualStoryPoints(tasks);

  const doneThisWeekTasks = tasks.filter((t) => {
    const c = completedAt(t);
    if (!c) return false;
    const ts = new Date(c).getTime();
    return ts >= nowTime - 7 * 86_400_000 && ts <= nowTime;
  });
  const weeklyStoryPointComparison = calcEstimatedVsActualStoryPoints(doneThisWeekTasks);

  const doneThisWeek = weeklyThroughput.reduce((s, d) => s + d.done, 0);
  const donePrevWeek = weeklyThroughput.reduce((s, d) => s + d.prevDone, 0);
  const wow = [
    { label: "throughput", icon: "✓", now: doneThisWeek, prev: donePrevWeek },
    { label: "created", icon: "＋", now: weekly.created, prev: weekly.prevCreated },
    { label: "completed", icon: "◆", now: weekly.done, prev: weekly.prevDone },
  ];

  return {
    tasks,
    nowAnchor,
    weekly,
    monthly,
    weeklyThroughput,
    kpis,
    byPriority,
    byType,
    byProject,
    productivityProfile,
    completionRate,
    avgTaskDurationDays,
    focusHours,
    longestStreak,
    storyPointComparison,
    doneThisWeekCount: doneThisWeekTasks.length,
    weeklyStoryPointComparison,
    wow,
  };
}
