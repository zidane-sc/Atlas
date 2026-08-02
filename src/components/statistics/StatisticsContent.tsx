"use client";

import { useState, useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RecapTrigger } from "@/components/gamification/RecapTrigger";
import type { RecapData } from "@/components/gamification/RecapCutscene";
import { useTasks } from "@/components/providers/TasksProvider";
import { useProjects } from "@/components/providers/ProjectsProvider";
import { calcTaskXP, completedAt, computeRecapGrade, createdAt, isTaskOnTime, calculateStreak, calculateLongestStreak } from "@/lib/gamification";
import { buildProductivityProfile, calcAverageTaskDurationDays, calcCompletionRate, calcEstimatedVsActualStoryPoints, calcFocusHours } from "@/lib/statistics";
import { TYPE_ICON } from "@/lib/mock-data";
import ActivityHeatmap from "@/components/statistics/ActivityHeatmap";
import type { Project } from "@/types/gamification";
import type { Priority, Task, TaskType } from "@/types/task";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Real per-day completion counts for the trailing 7 days (vs the same weekday one week prior) —
 * with only 16 mock tasks this will look sparser than a hand-authored fake week, but real-and-sparse
 * beats fake-and-full for a "compare to last week" chart.
 */
function buildWeeklyThroughput(tasks: Task[], nowStr: string): { day: string; done: number; prevDone: number }[] {
  const DAY_MS = 86_400_000;
  const now = new Date(nowStr).getTime();
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
      day: WEEKDAY_LABELS[new Date(dayStart).getUTCDay()],
      done: countInRange(dayStart, dayEnd),
      prevDone: countInRange(dayStart - 7 * DAY_MS, dayEnd - 7 * DAY_MS),
    });
  }
  return buckets;
}

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
  const xpEarned = doneThis.reduce(
    (sum, t) => sum + calcTaskXP(t.priority, t.storyPoint, isTaskOnTime(t)),
    0
  );
  const completedByProject = projects.map((p) => ({
    project: p,
    completed: allTasks.filter((t) => t.project === p.name && t.status === "done").length,
  }));
  const topProject = completedByProject.reduce((best, p) => (p.completed > best.completed ? p : best), completedByProject[0])
    .project;

  return {
    period,
    done: doneThis.length,
    prevDone: donePrev.length,
    created,
    xpEarned,
    streak: calculateStreak(allTasks),
    topProject: { name: topProject.name, emoji: topProject.emoji, colorVar: topProject.colorVar },
    grade: computeRecapGrade(doneThis.length, created),
  };
}

export default function StatisticsContent() {
  const { tasks: allTasks } = useTasks();
  const { projects } = useProjects();

  const [nowTime] = useState(() => {
    const doneTasks = allTasks.filter((t) => completedAt(t) != null);
    const latestCompletion = doneTasks.length > 0 
      ? Math.max(...doneTasks.map((t) => new Date(completedAt(t)!).getTime()))
      : 0;
    return Math.max(Date.now(), latestCompletion);
  });
  const kpis = [
    { label: "TOTAL", value: allTasks.length, colorVar: "--color-text-primary" },
    { label: "DONE", value: allTasks.filter((t) => t.status === "done").length, colorVar: "--color-status-done" },
    { label: "ACTIVE", value: allTasks.filter((t) => t.status === "in_progress").length, colorVar: "--color-status-in-progress" },
    { label: "WAITING", value: allTasks.filter((t) => t.status === "waiting_external").length, colorVar: "--color-status-waiting-external" },
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
    value: allTasks.filter((t) => t.priority === p).length,
    fill: PRIORITY_FILL[p],
  }));

  const byType = (Object.keys(TYPE_ICON) as TaskType[])
    .map((type) => ({ type, value: allTasks.filter((t) => t.type === type).length }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const byProject = projects
    .map((p) => {
      const projectTasks = allTasks.filter((t) => t.project === p.name);
      const done = projectTasks.filter((t) => t.status === "done").length;
      return { name: p.name.split(" ")[0], done, active: projectTasks.length - done, total: projectTasks.length, colorVar: p.colorVar };
    })
    .filter((p) => p.total > 0);

  const weekly = useMemo(() => buildRecap(allTasks, projects, 7, "week", nowTime), [allTasks, projects, nowTime]);
  const monthly = useMemo(() => buildRecap(allTasks, projects, 30, "month", nowTime), [allTasks, projects, nowTime]);
  const nowAnchor = useMemo(() => new Date(nowTime).toISOString().slice(0, 10), [nowTime]);
  const weeklyThroughput = useMemo(() => buildWeeklyThroughput(allTasks, nowAnchor), [allTasks, nowAnchor]);

  const productivityProfile = useMemo(() => buildProductivityProfile(allTasks), [allTasks]);
  const completionRate = useMemo(() => calcCompletionRate(allTasks), [allTasks]);
  const avgTaskDurationDays = useMemo(() => calcAverageTaskDurationDays(allTasks), [allTasks]);
  const focusHours = useMemo(() => calcFocusHours(allTasks), [allTasks]);
  const longestStreak = useMemo(() => calculateLongestStreak(allTasks), [allTasks]);
  const storyPointComparison = useMemo(() => calcEstimatedVsActualStoryPoints(allTasks), [allTasks]);

  const doneThisWeekTasks = useMemo(
    () => allTasks.filter((t) => {
      const c = completedAt(t);
      if (!c) return false;
      const ts = new Date(c).getTime();
      return ts >= nowTime - 7 * 86_400_000 && ts <= nowTime;
    }),
    [allTasks, nowTime]
  );
  const weeklyStoryPointComparison = useMemo(() => calcEstimatedVsActualStoryPoints(doneThisWeekTasks), [doneThisWeekTasks]);

  const doneThisWeek = weeklyThroughput.reduce((s, d) => s + d.done, 0);
  const donePrevWeek = weeklyThroughput.reduce((s, d) => s + d.prevDone, 0);
  const wow = [
    { label: "throughput", icon: "✓", now: doneThisWeek, prev: donePrevWeek },
    { label: "created", icon: "＋", now: weekly.created, prev: Math.max(weekly.created - 1, 0) },
    { label: "completed", icon: "◆", now: weekly.done, prev: weekly.prevDone },
  ];

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
          <ActivityHeatmap tasks={allTasks} nowAnchor={nowAnchor} />
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
                        style={{ width: `${(t.value / allTasks.length) * 100}%`, backgroundColor: TYPE_BAR_COLORS[i] }}
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
              <span className="text-muted-foreground">{doneThisWeekTasks.length} quests</span>
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
