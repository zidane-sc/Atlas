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
        className="flex items-center justify-between px-4 py-3 sm:px-6"
        style={{ borderBottom: "1px solid var(--color-border)", backgroundColor: "var(--color-bg-panel-alt)" }}
      >
        <h1 className="font-display" style={{ fontSize: "11px", color: "var(--color-primary-gold)" }}>📊 PROGRESS</h1>
        <RecapTrigger weekly={weekly} monthly={monthly} />
      </div>

      <div
        className="flex items-center gap-1 overflow-x-auto px-4 py-2 sm:px-6"
        style={{ backgroundColor: "var(--color-bg-panel-alt)", borderBottom: "1px solid var(--color-border)" }}
      >
        <span className="mr-3 shrink-0 font-display" style={{ fontSize: "7px", color: "var(--color-dim)" }}>VS LAST WEEK</span>
        {wow.map(({ label, icon, now, prev }) => {
          const delta = now - prev;
          const flat = delta === 0;
          const up = delta > 0;
          const pct = prev > 0 ? Math.round((Math.abs(delta) / prev) * 100) : now > 0 ? 100 : 0;
          const colorVar = flat ? "--color-text-muted" : up ? "--color-status-done" : "--color-status-blocked";
          return (
            <div key={label} className="mr-4 flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm" style={{ color: "var(--color-text-muted)" }}>
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

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
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
              <div className="flex flex-wrap items-center gap-4">
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
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-4 text-sm" style={{ borderColor: "var(--color-border)" }}>
              <span style={{ color: "var(--color-dim)" }}>SP EST. VS. ACTUAL (all-time)</span>
              <span style={{ color: "var(--color-text-primary)" }}>{storyPointComparison.estimated} SP estimated</span>
              <span style={{ color: "var(--color-dim)" }}>vs</span>
              <span style={{ color: "var(--color-text-primary)" }}>{storyPointComparison.actualHours}h actual</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
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
