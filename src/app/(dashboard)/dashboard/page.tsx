"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ChevronRight, Info } from "lucide-react";
import { PixBar } from "@/components/ui/PixBar";
import { StreakCampfire } from "@/components/gamification/StreakCampfire";
import { StatPanel } from "@/components/gamification/StatPanel";
import { DailyQuestCard } from "@/components/gamification/DailyQuestCard";
import { TaskListView } from "@/components/tasks/TaskListView";
import { useTasks } from "@/components/providers/TasksProvider";
import { useSettings } from "@/components/providers/SettingsProvider";
import { calcTaskCoins, calcTaskXP, completedAt, isTaskOnTime, calculateStreak, formatLocalDate } from "@/lib/gamification";
import { formatDueDate, isDueToday, isOverdue } from "@/lib/task-utils";
import { MOCK_NOW, TYPE_ICON, todaysDailyQuest } from "@/lib/mock-data";

export default function Page() {
  const { compactView } = useSettings();
  const { tasks, allTimeTasks, characterSheet, activityLogs, lastQuestClaimedAt, claimDailyQuest } = useTasks();
  const sheet = characterSheet;
  const streakDays = useMemo(() => calculateStreak(allTimeTasks), [allTimeTasks]);
  const { classTitle } = sheet;
  const dailyQuestClaimed = lastQuestClaimedAt != null && formatLocalDate(lastQuestClaimedAt) === MOCK_NOW;

  const notDone = tasks.filter((t) => t.status !== "done");
  const dueToday = notDone.filter((t) => isDueToday(t.dueDate, MOCK_NOW)).length;
  const overdue = notDone.filter((t) => isOverdue(t.dueDate, MOCK_NOW)).length;
  const inProgressCount = notDone.filter((t) => t.status === "in_progress").length;
  const doneTodayCount = useMemo(() => {
    return tasks.filter((t) => {
      if (t.status !== "done") return false;
      const at = completedAt(t);
      return at ? formatLocalDate(at) === MOCK_NOW : false;
    }).length;
  }, [tasks]);

  const todaysQuest = notDone.filter((t) => isDueToday(t.dueDate, MOCK_NOW) || t.status === "in_progress");
  const recentWins = tasks
    .filter((t) => t.status === "done")
    .map((t) => ({ task: t, completedAt: completedAt(t) }))
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))
    .slice(0, 3);

  const xpPercentage = Math.min(100, Math.round((sheet.xpIntoLevel / sheet.xpForNextLevel) * 100));

  return (
    <main className="flex h-full flex-col gap-3.5 overflow-y-auto p-4 sm:p-5">
      {/* Hero panel — compact high-density banner */}
      <div className="border-2 border-primary bg-card p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
          {/* Top row on mobile / Left group on desktop */}
          <div className="flex items-center justify-between sm:justify-start gap-3 sm:pr-4 sm:border-r-2 border-border">
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-center">
                <span className="text-[9px] tracking-widest text-muted-foreground font-mono">LEVEL</span>
                <span
                  style={{
                    fontFamily: "var(--font-press-start), monospace",
                    fontSize: "22px",
                    color: "var(--color-xp-gold)",
                    textShadow: "0 0 10px rgba(255,217,61,0.4)",
                  }}
                >
                  {sheet.globalLevel}
                </span>
              </div>
              <span
                className="border px-1.5 py-0.5 text-[9px] font-mono tracking-wider"
                style={{ borderColor: "var(--color-primary-gold)", color: "var(--color-primary-gold)" }}
              >
                {classTitle.toUpperCase()}
              </span>
            </div>

            {/* Streak & Coins visible on right side on mobile */}
            <div className="flex sm:hidden items-center gap-3">
              <StreakCampfire days={streakDays} />
              <div className="flex items-center gap-1 font-mono text-xs">
                <span aria-hidden>🪙</span>
                <span style={{ fontFamily: "var(--font-press-start), monospace", fontSize: "11px", color: "var(--color-coin)" }}>
                  {sheet.totalCoins}
                </span>
              </div>
            </div>
          </div>

          {/* XP Progress bar */}
          <div className="flex flex-1 flex-col justify-center min-w-0">
            <div className="mb-1 flex justify-between text-[11px] text-muted-foreground font-mono">
              <span>XP PROGRESS</span>
              <span style={{ color: "var(--color-xp-gold)" }}>
                {sheet.xpIntoLevel.toLocaleString()} / {sheet.xpForNextLevel.toLocaleString()} ({xpPercentage}%)
              </span>
            </div>
            <PixBar value={sheet.xpIntoLevel} max={sheet.xpForNextLevel} colorVar="--color-xp-gold" blocks={20} showLabel={false} />
            <div className="mt-0.5 text-[10px] text-muted-foreground font-mono truncate">
              {(sheet.xpForNextLevel - sheet.xpIntoLevel).toLocaleString()} XP to Lv.{sheet.globalLevel + 1}
            </div>
          </div>

          {/* Desktop Streak & Coins */}
          <div className="hidden sm:flex items-center gap-4 pl-4 border-l-2 border-border shrink-0">
            <div className="flex flex-col items-center">
              <StreakCampfire days={streakDays} />
            </div>

            <div className="flex flex-col items-center justify-center pl-4 border-l-2 border-border/40">
              <div className="text-base" aria-hidden>🪙</div>
              <div
                style={{
                  fontFamily: "var(--font-press-start), monospace",
                  fontSize: "13px",
                  color: "var(--color-coin)",
                }}
              >
                {sheet.totalCoins}
              </div>
              <div className="text-[10px] text-muted-foreground font-mono">COINS</div>
            </div>
          </div>
        </div>
      </div>

      {/* 4-Column Stat Matrix */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-4">
        <StatPanel label="Due Today" value={dueToday} shape="◆" colorVar="--color-primary-gold" href="/tasks/today" />
        <StatPanel label="Overdue" value={overdue} shape="▲" colorVar="--color-status-blocked" href="/tasks/overdue" />
        <StatPanel label="In Progress" value={inProgressCount} shape="▶" colorVar="--color-status-in-progress" href="/tasks" />
        <StatPanel label="Completed Today" value={doneTodayCount} shape="✓" colorVar="--color-status-done" href="/statistics" />
      </div>

      {/* Daily Quest */}
      <DailyQuestCard
        tasks={tasks}
        claimed={dailyQuestClaimed}
        onClaim={() => {
          claimDailyQuest(MOCK_NOW, todaysDailyQuest.xp, todaysDailyQuest.coins);
        }}
      />

      {/* Quests dual lists */}
      <div className="grid gap-3.5 md:grid-cols-2">
        <section className="border-2 border-border bg-card p-3 sm:p-3.5">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-xs font-mono font-bold tracking-wider" style={{ color: "var(--color-primary-gold)" }}>
              ◆ TODAY&apos;S QUESTS
            </span>
          </div>
          <TaskListView tasks={todaysQuest} variant={compactView ? "compact" : "card"} empty="[ ALL CLEAR ]" />
        </section>

        <section className="border-2 border-border bg-card p-3 sm:p-3.5">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-xs font-mono font-bold tracking-wider" style={{ color: "var(--color-status-in-progress)" }}>
              ▶ IN PROGRESS
            </span>
          </div>
          <TaskListView tasks={tasks.filter((t) => t.status === "in_progress").slice(0, 5)} empty="[ NONE ]" variant="compact" showStatus={false} />
        </section>
      </div>

      {/* Recent Activities */}
      {activityLogs && activityLogs.length > 0 && (
        <div className="border-2 border-border bg-card p-3 sm:p-3.5">
          <div className="mb-2 flex items-center gap-1.5" title="Tracks: task created/completed/updated/deleted/focused, comments, projects, sprints">
            <span className="text-xs font-mono font-bold tracking-wider" style={{ color: "var(--color-primary-gold)" }}>
              ◫ RECENT ACTIVITIES
            </span>
            <Info size={12} className="opacity-50" style={{ cursor: "help" }} />
          </div>
          <div className="flex flex-col gap-1.5">
            {activityLogs.map((log) => {
              const details = log.details as any;
              const getChangesSummary = () => {
                if (!details?.changes) return null;
                const changes = details.changes as Record<string, { from: any; to: any }>;
                const summary = Object.entries(changes)
                  .map(([key, value]) => {
                    if (key === "status") return `${value.from} → ${value.to}`;
                    if (key === "priority") return `priority: ${value.to}`;
                    return null;
                  })
                  .filter(Boolean)
                  .join(", ");
                return summary ? `(${summary})` : null;
              };

              return (
                <div key={log.id} className="flex justify-between items-center text-xs border-b border-border/30 pb-1 last:border-b-0 last:pb-0 gap-2">
                  <div className="flex items-center gap-1.5 flex-1 min-w-0 truncate">
                    <span className="font-bold text-muted-foreground">{log.actorName}</span>
                    <span className="text-muted-foreground">{log.action}</span>
                    {getChangesSummary() && (
                      <span className="text-muted-foreground">{getChangesSummary()}</span>
                    )}
                    {log.taskTitle && (
                      <span className="text-foreground font-semibold truncate">&quot;{log.taskTitle}&quot;</span>
                    )}
                    {log.projectName && (
                      <span className="inline-flex items-center gap-1 text-foreground font-semibold shrink-0">
                        <span>{log.projectEmoji}</span>
                        <span>{log.projectName}</span>
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground shrink-0 font-mono">
                    {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Wins */}
      {recentWins.length > 0 && (
        <div className="border-2 border-border bg-card p-3 sm:p-3.5">
          <div className="mb-2 text-xs font-mono font-bold tracking-wider" style={{ color: "var(--color-status-ready)" }}>
            ✓ RECENT WINS
          </div>
          {recentWins.map(({ task }) => {
            const xp = calcTaskXP(task.priority, task.size, isTaskOnTime(task));
            const coins = calcTaskCoins(task.priority, task.size);
            return (
              <div key={task.id} className="flex items-center gap-2 border-b border-border/40 py-1 text-xs">
                <span style={{ color: "var(--color-status-done)" }}>✓</span>
                <span className="text-sm shrink-0">{TYPE_ICON[task.type]}</span>
                <span className="flex-1 truncate text-muted-foreground line-through">{task.title}</span>
                <span className="font-bold font-mono" style={{ color: "var(--color-xp-gold)" }}>+{xp} XP</span>
                <span className="font-mono" style={{ color: "var(--color-coin)" }}>+{coins}🪙</span>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
