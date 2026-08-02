# Server-Computed Statistics & Achievements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the Statistics and Achievements pages from client-side computation (over a client-held task array) to server-computed data, per `docs/superpowers/specs/2026-08-02-server-computed-stats-achievements-design.md`.

**Architecture:** `app/(dashboard)/statistics/page.tsx` and `.../achievements/page.tsx` become `async` Server Components that resolve the session, run one fresh unbounded `db.task.findMany`, call the *same, unchanged* pure functions already in `gamification.ts`/`statistics.ts`, and pass one plain computed object as a prop down through the existing client wrappers into `StatisticsContent`/`AchievementsContent`, which become pure rendering components with no data-fetching of their own.

**Tech Stack:** Next.js App Router (Server Components), Prisma, existing pure functions in `src/lib/gamification.ts`/`src/lib/statistics.ts` (unchanged).

## Global Constraints

- Do not modify any function in `src/lib/gamification.ts` or `src/lib/statistics.ts` — they're already correct and tested; only *where* they're called changes (server instead of client).
- This repo has no Prisma/next-auth mocking harness — new server-side data-fetching glue is verified via `npx tsc --noEmit`, the existing `npx vitest run` suite (104 tests, must stay 104/104 passing), `npx next build`, and a manual browser check — not new unit tests. This matches every prior refactor this session (see `docs/05-backlog.md` §7/§8 for precedent).
- Every task ends with: typecheck clean (no *new* errors beyond the 14 pre-existing errors in 6 test files already in the repo, confirmed via `npx tsc --noEmit -p tsconfig.json`), then commit.
- Character Sheet (XP/level/coins) is explicitly out of scope — do not touch `Sidebar.tsx`, `CharacterContent.tsx`, `RoomDecoration.tsx`, `SaveAndQuitOverlay.tsx`, `settings/page.tsx`'s character-sheet usage, or `dashboard/page.tsx`'s character-sheet usage.
- `TasksProvider`'s `allTimeTasks`/`allDoneTasksBeyondWindow` stays in place — do not remove it, it's still used by the Character Sheet consumers and `TaskFormSheet`'s relation-trashed check.

---

### Task 1: Statistics server-side data layer

**Files:**
- Create: `src/lib/statistics-data.ts`

**Interfaces:**
- Consumes: `auth` (`@/lib/auth`), `db` (`@/lib/db`), `mapDbTaskToClient`/`mapDbProjectToClient` (`@/lib/tasks-reducer`), `calcTaskXP`/`completedAt`/`computeRecapGrade`/`createdAt`/`isTaskOnTime`/`calculateStreak`/`calculateLongestStreak`/`parseLocalDate` (`@/lib/gamification`), `buildProductivityProfile`/`calcAverageTaskDurationDays`/`calcCompletionRate`/`calcEstimatedVsActualStoryPoints`/`calcFocusHours` (`@/lib/statistics`), `TYPE_ICON` (`@/lib/mock-data`), `RecapData` (`@/components/gamification/RecapCutscene`), `Task`/`Priority`/`TaskType` (`@/types/task`), `Project` (`@/types/gamification`).
- Produces: `export interface StatisticsData { ... }` (full shape below) and `export async function getStatisticsPageData(): Promise<StatisticsData | null>` — the two names/shapes every later task in this plan relies on.

- [ ] **Step 1: Write `src/lib/statistics-data.ts`**

```ts
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
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "statistics-data"`
Expected: no output (clean).

- [ ] **Step 3: Commit**

```bash
git add src/lib/statistics-data.ts
git commit -m "feat: add server-side Statistics data computation"
```

---

### Task 2: Wire the Statistics page to server-computed data

**Files:**
- Modify: `src/app/(dashboard)/statistics/page.tsx`
- Modify: `src/components/statistics/StatisticsPage.tsx`
- Modify: `src/components/statistics/StatisticsContent.tsx`

**Interfaces:**
- Consumes: `getStatisticsPageData`, `StatisticsData` from `@/lib/statistics-data` (Task 1).
- Produces: nothing consumed by later tasks (Statistics and Achievements are independent).

- [ ] **Step 1: Rewrite the route file to fetch and redirect on missing session**

`src/app/(dashboard)/statistics/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { StatisticsPage } from "@/components/statistics/StatisticsPage";
import { getStatisticsPageData } from "@/lib/statistics-data";

export default async function Page() {
  const stats = await getStatisticsPageData();
  if (!stats) redirect("/auth");
  return <StatisticsPage stats={stats} />;
}
```

- [ ] **Step 2: Thread the prop through the lazy-loading wrapper**

`src/components/statistics/StatisticsPage.tsx` — replace the whole file:

```tsx
"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import type { StatisticsData } from "@/lib/statistics-data";

const StatisticsContent = dynamic(
  () => import("./StatisticsContent"),
  {
    loading: () => (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted-foreground/20 rounded" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-64 bg-muted-foreground/20 rounded" />
            <div className="h-64 bg-muted-foreground/20 rounded" />
          </div>
        </div>
      </div>
    ),
    ssr: false,
  }
);

export function StatisticsPage({ stats }: { stats: StatisticsData }) {
  return (
    <Suspense fallback={<div className="p-8">Loading statistics...</div>}>
      <StatisticsContent stats={stats} />
    </Suspense>
  );
}
```

- [ ] **Step 3: Replace `StatisticsContent.tsx` with a pure rendering component**

Replace the whole file `src/components/statistics/StatisticsContent.tsx`:

```tsx
"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RecapTrigger } from "@/components/gamification/RecapTrigger";
import { TYPE_ICON } from "@/lib/mock-data";
import ActivityHeatmap from "@/components/statistics/ActivityHeatmap";
import type { StatisticsData } from "@/lib/statistics-data";

/** recharts sets fill/stroke as raw SVG presentation attributes, which don't reliably
 * resolve CSS custom properties across browsers — literal hex here, mirroring globals.css. */
const CHART_COLORS = {
  border: "#1e2330",
  textMuted: "#6b7483",
  ready: "#4ecca3",
  dim: "#3a3f50",
  red: "#e94560",
  yellow: "#f6c90e",
  violet: "#a29bfe",
  cyan: "#00b8d9",
};

/** Reference's fixed per-row bar-chart palette for "By Type" (App.tsx barC). */
const TYPE_BAR_COLORS = [CHART_COLORS.red, CHART_COLORS.yellow, CHART_COLORS.ready, CHART_COLORS.violet, CHART_COLORS.cyan, CHART_COLORS.textMuted];

const TOOLTIP_STYLE = {
  backgroundColor: "var(--color-bg-panel)",
  border: "2px solid var(--color-primary-gold)",
  color: "var(--color-text-primary)",
  fontFamily: "VT323, monospace",
  fontSize: "14px",
};

export default function StatisticsContent({ stats }: { stats: StatisticsData }) {
  const {
    tasks, nowAnchor, weekly, monthly, weeklyThroughput, kpis, byPriority, byType, byProject,
    productivityProfile, completionRate, avgTaskDurationDays, focusHours, longestStreak,
    storyPointComparison, doneThisWeekCount, weeklyStoryPointComparison, wow,
  } = stats;

  return (
    <main className="flex h-full flex-col">
      <div
        className="flex items-center justify-between px-6 py-3"
        style={{ borderBottom: "1px solid var(--color-border)", backgroundColor: "var(--color-bg-panel-alt)" }}
      >
        <h1 className="font-display" style={{ fontSize: "11px", color: "var(--color-primary-gold)" }}>📊 PROGRESS</h1>
        <RecapTrigger weekly={weekly} monthly={monthly} />
      </div>

      <div
        className="flex flex-wrap items-center gap-1 px-6 py-2"
        style={{ backgroundColor: "var(--color-bg-panel-alt)", borderBottom: "1px solid var(--color-border)" }}
      >
        <span className="mr-3 font-display shrink-0" style={{ fontSize: "7px", color: "var(--color-dim)" }}>VS LAST WEEK</span>
        {wow.map(({ label, icon, now, prev }) => {
          const delta = now - prev;
          const flat = delta === 0;
          const up = delta > 0;
          const pct = prev > 0 ? Math.round((Math.abs(delta) / prev) * 100) : now > 0 ? 100 : 0;
          const colorVar = flat ? "--color-text-muted" : up ? "--color-status-done" : "--color-status-blocked";
          return (
            <div key={label} className="mr-4 flex items-center gap-1.5 text-sm" style={{ color: "var(--color-text-muted)" }}>
              <span style={{ color: "var(--color-dim)" }}>{icon}</span>
              <span>{label}:</span>
              <span style={{ color: "var(--color-text-primary)" }}>{now}</span>
              <span style={{ color: "var(--color-dim)" }}>vs {prev}</span>
              <span
                className="font-display"
                style={{ color: `var(${colorVar})`, border: `1px solid var(${colorVar})`, padding: "0 5px", fontSize: "7px", opacity: flat ? 0.5 : 1 }}
              >
                {flat ? "—" : up ? `↑+${delta}` : ` ↓${delta}`}{!flat && ` (${pct}%)`}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex flex-col gap-5">
          <ActivityHeatmap tasks={tasks} nowAnchor={nowAnchor} />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {kpis.map((k) => (
              <div key={k.label} className="border-2 border-border bg-card p-4 text-center">
                <div className="font-display text-2xl" style={{ color: `var(${k.colorVar})` }}>
                  {k.value}
                </div>
                <div className="mt-2 text-sm tracking-widest text-muted-foreground">{k.label}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="border-2 border-border bg-card p-4">
              <div className="mb-4 flex items-baseline justify-between">
                <span className="text-sm tracking-widest" style={{ color: "var(--color-status-ready)" }}>▸ WEEKLY THROUGHPUT</span>
                <span className="flex items-center gap-3 text-sm" style={{ color: "var(--color-dim)" }}>
                  <span className="mr-[3px] inline-block h-[10px] w-[10px]" style={{ backgroundColor: "var(--color-status-ready)" }} />this week
                  <span className="mr-[3px] inline-block h-[10px] w-[10px]" style={{ backgroundColor: "var(--color-dim)" }} />last week
                </span>
              </div>
              <ResponsiveContainer width="100%" height={170}>
                <BarChart data={weeklyThroughput}>
                  <CartesianGrid strokeDasharray="4 4" stroke={CHART_COLORS.border} />
                  <XAxis dataKey="day" stroke={CHART_COLORS.border} tick={{ fill: CHART_COLORS.textMuted, fontFamily: "VT323, monospace", fontSize: 13 }} />
                  <YAxis stroke={CHART_COLORS.border} tick={{ fill: CHART_COLORS.textMuted, fontFamily: "VT323, monospace", fontSize: 13 }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="prevDone" name="Last Week" fill={CHART_COLORS.dim} opacity={0.5} />
                  <Bar dataKey="done" name="This Week" fill={CHART_COLORS.ready} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="border-2 border-border bg-card p-4">
              <div className="mb-4 text-sm tracking-widest" style={{ color: "var(--color-status-ready)" }}>▸ BY PROJECT</div>
              <ResponsiveContainer width="100%" height={170}>
                <BarChart data={byProject} layout="vertical">
                  <CartesianGrid strokeDasharray="4 4" stroke={CHART_COLORS.border} />
                  <XAxis type="number" stroke={CHART_COLORS.border} tick={{ fill: CHART_COLORS.textMuted, fontFamily: "VT323, monospace", fontSize: 11 }} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" width={55} stroke={CHART_COLORS.border} tick={{ fill: CHART_COLORS.textMuted, fontFamily: "VT323, monospace", fontSize: 11 }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="done" name="Done" stackId="a" fill={CHART_COLORS.ready} />
                  <Bar dataKey="active" name="Active" stackId="a" fill={CHART_COLORS.border} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="border-2 border-border bg-card p-4">
              <div className="mb-4 text-sm tracking-widest" style={{ color: "var(--color-status-ready)" }}>▸ BY PRIORITY</div>
              <div className="flex items-center gap-4">
                <ResponsiveContainer width={130} height={130}>
                  <PieChart>
                    <Pie data={byPriority} dataKey="value" cx="50%" cy="50%" outerRadius={60} paddingAngle={2}>
                      {byPriority.map((p) => <Cell key={p.key} fill={p.fill} />)}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-2">
                  {byPriority.map((p) => (
                    <div key={p.key} className="flex items-center gap-2 text-sm">
                      <div className="h-3 w-3 shrink-0" style={{ backgroundColor: p.fill }} />
                      <span className="text-muted-foreground">{p.label}</span>
                      <span className="ml-auto pl-2 text-foreground">{p.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-2 border-border bg-card p-4">
              <div className="mb-4 text-sm tracking-widest" style={{ color: "var(--color-status-ready)" }}>▸ BY TYPE</div>
              <div className="flex flex-col gap-2">
                {byType.map((t, i) => (
                  <div key={t.type} className="flex items-center gap-3">
                    <span className="w-5 shrink-0 text-sm">{TYPE_ICON[t.type]}</span>
                    <span className="w-24 truncate text-sm text-muted-foreground">{t.type}</span>
                    <div className="h-3 flex-1" style={{ backgroundColor: "var(--color-bg-panel-alt)" }}>
                      <div
                        className="h-full"
                        style={{ width: `${(t.value / tasks.length) * 100}%`, backgroundColor: TYPE_BAR_COLORS[i] }}
                      />
                    </div>
                    <span className="w-4 text-right text-sm text-foreground">{t.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="border-2 border-border bg-card p-4">
            <div className="mb-4 text-sm tracking-widest" style={{ color: "var(--color-status-ready)" }}>▸ PRODUCTIVITY</div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <StatTile label="COMPLETION RATE" value={`${completionRate}%`} />
              <StatTile label="LONGEST STREAK" value={`${longestStreak}d`} />
              <StatTile label="FOCUS HOURS" value={`${focusHours}h`} />
              <StatTile label="AVG TASK DURATION" value={avgTaskDurationDays != null ? `${avgTaskDurationDays}d` : "—"} />
              <StatTile label="BEST DAY" value={productivityProfile.bestWeekday ?? "—"} />
              <StatTile label="BEST TIME" value={productivityProfile.bestPeriod ?? "—"} />
            </div>
            <div className="mt-4 flex items-center gap-3 border-t pt-4 text-sm" style={{ borderColor: "var(--color-border)" }}>
              <span style={{ color: "var(--color-dim)" }}>SP EST. VS. ACTUAL (all-time)</span>
              <span style={{ color: "var(--color-text-primary)" }}>{storyPointComparison.estimated} SP estimated</span>
              <span style={{ color: "var(--color-dim)" }}>vs</span>
              <span style={{ color: "var(--color-text-primary)" }}>{storyPointComparison.actualHours}h actual</span>
            </div>
            <div className="mt-3 flex items-center gap-3 text-sm">
              <span style={{ color: "var(--color-dim)" }}>◆ THIS WEEK</span>
              <span className="text-muted-foreground">{doneThisWeekCount} quests</span>
              <span style={{ color: "var(--color-text-primary)" }}>{weeklyStoryPointComparison.estimated} SP est.</span>
              <span style={{ color: "var(--color-dim)" }}>vs</span>
              <span style={{ color: "var(--color-text-primary)" }}>{weeklyStoryPointComparison.actualHours}h</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="font-display text-lg" style={{ color: "var(--color-text-primary)" }}>{value}</div>
      <div className="mt-1 text-sm tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -iE "statistics-data|StatisticsPage|StatisticsContent|statistics/page"`
Expected: no output.

- [ ] **Step 5: Run the existing test suite and build**

Run: `npx vitest run 2>&1 | tail -5`
Expected: `PASS (104) FAIL (0)` — same as before this change.

Run: `npx next build 2>&1 | tail -10`
Expected: `Errors: 0 | Warnings: 0`.

- [ ] **Step 6: Manual browser check**

Start the dev server, sign in, navigate to `/statistics`. Confirm: KPI tiles, weekly throughput chart, by-project/priority/type panels, activity heatmap, and the productivity panel all render with real numbers (not blank/zero unless the account genuinely has no data). Confirm the "VS LAST WEEK" bar and the Weekly/Monthly Recap trigger still work.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(dashboard)/statistics/page.tsx" src/components/statistics/StatisticsPage.tsx src/components/statistics/StatisticsContent.tsx
git commit -m "refactor: compute Statistics page data server-side"
```

---

### Task 3: Achievements server-side data layer

**Files:**
- Create: `src/lib/achievements-data.ts`

**Interfaces:**
- Consumes: `auth`, `db`, `mapDbTaskToClient`/`mapDbProjectToClient`/`mapDbSprintToClient` (`@/lib/tasks-reducer`), `computeAchievementProgress`/`computeUnlockedAchievements` (`@/lib/gamification`), `mockAchievements` (`@/lib/mock-data`), `Achievement` (`@/types/gamification`).
- Produces: `export interface AchievementDisplay extends Achievement { progress: { current: number; max: number } | null }` and `export async function getAchievementsPageData(): Promise<AchievementDisplay[] | null>` — the two names/shapes Task 4 relies on.

- [ ] **Step 1: Write `src/lib/achievements-data.ts`**

```ts
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { mapDbTaskToClient, mapDbProjectToClient, mapDbSprintToClient } from "@/lib/tasks-reducer";
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

  const [dbTasks, dbProjects, dbSprints] = await Promise.all([
    db.task.findMany({ where: { ownerId: owner.id, deletedAt: null } }),
    db.project.findMany({ where: { archivedAt: null } }),
    db.sprint.findMany(),
  ]);

  const tasks = dbTasks.map((t) => mapDbTaskToClient(t, dbProjects, dbSprints));
  const projects = dbProjects.map(mapDbProjectToClient);
  const sprints = dbSprints.map(mapDbSprintToClient);

  const unlockStatus = computeUnlockedAchievements(tasks, projects, sprints);

  return mockAchievements.map((a) => {
    const status = unlockStatus[a.id];
    return {
      ...a,
      unlocked: status.unlocked,
      unlockedAt: status.unlockedAt,
      progress: status.unlocked ? null : computeAchievementProgress(a.id, tasks, projects, sprints),
    };
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "achievements-data"`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/lib/achievements-data.ts
git commit -m "feat: add server-side Achievements data computation"
```

---

### Task 4: Wire the Achievements page to server-computed data

**Files:**
- Modify: `src/app/(dashboard)/achievements/page.tsx`
- Modify: `src/components/gamification/AchievementsPage.tsx`
- Modify: `src/components/gamification/AchievementsContent.tsx`

**Interfaces:**
- Consumes: `getAchievementsPageData`, `AchievementDisplay` from `@/lib/achievements-data` (Task 3).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Rewrite the route file**

`src/app/(dashboard)/achievements/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { AchievementsPage } from "@/components/gamification/AchievementsPage";
import { getAchievementsPageData } from "@/lib/achievements-data";

export default async function Page() {
  const achievements = await getAchievementsPageData();
  if (!achievements) redirect("/auth");
  return <AchievementsPage achievements={achievements} />;
}
```

- [ ] **Step 2: Thread the prop through the lazy-loading wrapper**

`src/components/gamification/AchievementsPage.tsx` — replace the whole file:

```tsx
"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import type { AchievementDisplay } from "@/lib/achievements-data";

const AchievementsContent = dynamic(
  () => import("./AchievementsContent"),
  {
    loading: () => (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted-foreground/20 rounded" />
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-40 bg-muted-foreground/20 rounded" />
            ))}
          </div>
        </div>
      </div>
    ),
    ssr: false,
  }
);

export function AchievementsPage({ achievements }: { achievements: AchievementDisplay[] }) {
  return (
    <Suspense fallback={<div className="p-8">Loading achievements...</div>}>
      <AchievementsContent achievements={achievements} />
    </Suspense>
  );
}
```

- [ ] **Step 3: Replace `AchievementsContent.tsx` with a pure rendering component**

Replace the whole file `src/components/gamification/AchievementsContent.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import type { AchievementDisplay } from "@/lib/achievements-data";
import type { AchievementCategory } from "@/types/gamification";

const CATEGORIES: { key: AchievementCategory; label: string; colorVar: string }[] = [
  { key: "combat", label: "combat", colorVar: "--color-priority-p0" },
  { key: "exploration", label: "exploration", colorVar: "--color-status-ready" },
  { key: "crafting", label: "crafting", colorVar: "--color-status-in-progress" },
  { key: "social", label: "social", colorVar: "--color-status-waiting-external" },
];

type Filter = "all" | "unlocked" | "locked";

export default function AchievementsContent({ achievements }: { achievements: AchievementDisplay[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const unlocked = achievements.filter((a) => a.unlocked).length;
  const earnedXP = achievements.filter((a) => a.unlocked).reduce((s, a) => s + a.xp, 0);
  const filtered = achievements.filter((a) => (filter === "all" ? true : filter === "unlocked" ? a.unlocked : !a.unlocked));

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex items-center justify-between px-6 py-3"
        style={{ borderBottom: "1px solid var(--color-border)", backgroundColor: "var(--color-bg-panel-alt)" }}
      >
        <div>
          <h1 style={{ fontFamily: "var(--font-press-start), monospace", fontSize: "11px", color: "var(--color-primary-gold)" }}>
            🏆 ACHIEVEMENTS
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: "var(--color-text-muted)" }}>
            {unlocked}/{achievements.length} unlocked · {earnedXP} XP earned
          </p>
        </div>
        <div className="flex gap-1">
          {(["all", "unlocked", "locked"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-3 py-0.5 text-sm transition-colors"
              style={{
                border: `1px solid ${filter === f ? "var(--color-primary-gold)" : "var(--color-border)"}`,
                color: filter === f ? "var(--color-primary-gold)" : "var(--color-text-muted)",
                backgroundColor: filter === f ? "var(--color-bg-panel)" : "transparent",
              }}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {CATEGORIES.map((cat) => {
          const items = filtered.filter((a) => a.category === cat.key);
          if (items.length === 0) return null;
          return (
            <div key={cat.key} className="mb-6">
              <div className="mt-5 mb-2 flex items-center gap-2">
                <span className="text-sm" style={{ color: "var(--color-primary-gold)" }}>▸</span>
                <span className="text-sm tracking-widest uppercase" style={{ color: "var(--color-text-muted)" }}>
                  {cat.label.toUpperCase()} DEEDS
                </span>
                <div className="h-px flex-1" style={{ backgroundColor: "var(--color-border)" }} />
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                {items.map((a) => {
                  const progress = a.progress;
                  const progressPct = progress ? Math.min(1, progress.current / progress.max) : 0;
                  return (
                    <div
                      key={a.id}
                      className="flex flex-col p-4"
                      style={{
                        backgroundColor: "var(--color-bg-panel)",
                        border: `2px solid ${a.unlocked ? "var(--color-primary-gold)" : "var(--color-border)"}`,
                        opacity: a.unlocked ? 1 : progress && progress.current > 0 ? 0.85 : 0.5,
                      }}
                    >
                      <div className="mb-2 flex items-start justify-between">
                        <span className="text-3xl leading-none">{a.icon}</span>
                        {a.unlocked ? (
                          <span
                            className="px-1.5 py-0.5 text-sm"
                            style={{ color: "var(--color-status-ready)", border: "1px solid var(--color-status-ready)" }}
                          >
                            ✓ DONE
                          </span>
                        ) : progress && progress.current > 0 ? (
                          <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                            {progress.current}/{progress.max}
                          </span>
                        ) : (
                          <Lock size={12} style={{ color: "var(--color-dim)" }} />
                        )}
                      </div>
                      <div
                        className="mb-1 text-sm font-bold"
                        style={{ color: a.unlocked ? "var(--color-text-primary)" : "var(--color-text-muted)" }}
                      >
                        {a.name}
                      </div>
                      <p className="mb-3 flex-1 text-sm leading-tight" style={{ color: "var(--color-dim)" }}>
                        {a.description}
                      </p>
                      {progress && progress.current > 0 && !a.unlocked && (
                        <div className="mb-2">
                          <div className="mb-1 flex gap-[2px]">
                            {Array.from({ length: 10 }).map((_, i) => (
                              <div
                                key={i}
                                className="h-1.5 flex-1"
                                style={{
                                  backgroundColor: i < Math.round(progressPct * 10) ? `var(${cat.colorVar})` : "var(--color-bg-panel-alt)",
                                  border: `1px solid ${i < Math.round(progressPct * 10) ? `var(${cat.colorVar})` : "var(--color-border)"}`,
                                }}
                              />
                            ))}
                          </div>
                          <div className="text-sm" style={{ color: "var(--color-dim)" }}>
                            {Math.round(progressPct * 100)}% complete
                          </div>
                        </div>
                      )}
                      <div className="mt-auto flex items-center justify-between">
                        <span className="text-sm font-bold" style={{ color: `var(${cat.colorVar})` }}>
                          +{a.xp} XP
                        </span>
                        {a.unlocked && a.unlockedAt && (
                          <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                            {a.unlockedAt}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -iE "achievements-data|AchievementsPage|AchievementsContent|achievements/page"`
Expected: no output.

- [ ] **Step 5: Run the existing test suite and build**

Run: `npx vitest run 2>&1 | tail -5`
Expected: `PASS (104) FAIL (0)`.

Run: `npx next build 2>&1 | tail -10`
Expected: `Errors: 0 | Warnings: 0`.

- [ ] **Step 6: Manual browser check**

Navigate to `/achievements`. Confirm: unlocked/locked counts and earned-XP header, the ALL/UNLOCKED/LOCKED filter buttons, category groupings, and per-achievement progress bars all render correctly and match what they showed before this change (compare against the same account's state pre-refactor if unsure).

- [ ] **Step 7: Commit**

```bash
git add "src/app/(dashboard)/achievements/page.tsx" src/components/gamification/AchievementsPage.tsx src/components/gamification/AchievementsContent.tsx
git commit -m "refactor: compute Achievements page data server-side"
```

---

### Task 5: Full verification and docs update

**Files:**
- Modify: `docs/05-backlog.md`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing (terminal task).

- [ ] **Step 1: Full verification pass**

Run in sequence:
```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | tail -6
npx vitest run 2>&1 | tail -6
npx next build 2>&1 | tail -10
```
Expected: same 14 pre-existing errors in 6 test files as before this plan (no new ones), `PASS (104) FAIL (0)`, `Errors: 0 | Warnings: 0`.

- [ ] **Step 2: Confirm no remaining references to the old client-side computation path**

Run: `grep -rn "useTasks\|useProjects\|useSprints" src/components/statistics/StatisticsContent.tsx src/components/gamification/AchievementsContent.tsx`
Expected: no output — both files no longer call any provider hooks.

- [ ] **Step 3: Update `docs/05-backlog.md`**

Add a new entry to the Epic Index / §8 findings area (append after the existing finding #16 row) documenting this migration:

```markdown
| 17 | Statistics and Achievements pages computed all derived data (completion rate, achievements, streaks, etc.) client-side from a bulk task array, instead of server-side | Architecture improvement (user-raised, not from the audit) | **Fixed** — both pages are now `async` Server Components (`app/(dashboard)/statistics/page.tsx`, `.../achievements/page.tsx`) that fetch fresh unbounded data and call the same unchanged pure functions in `gamification.ts`/`statistics.ts` server-side, passing one plain computed object down as a prop. `StatisticsContent`/`AchievementsContent` are now pure rendering components with no data-fetching. Character Sheet (XP/level/coins) deliberately stays client-computed — see `docs/superpowers/specs/2026-08-02-server-computed-stats-achievements-design.md` §2 for why, and the "Phase 2" note there for what's still open |
```

- [ ] **Step 4: Commit**

```bash
git add docs/05-backlog.md
git commit -m "docs: record server-computed Statistics/Achievements migration"
```
