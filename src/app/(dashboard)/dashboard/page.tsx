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
  const { settings } = useSettings();
  const compactView = settings.find((s) => s.key === "compactView")?.value ?? false;
  const { tasks, allTimeTasks, characterSheet, activityLogs, lastQuestClaimedAt, claimDailyQuest } = useTasks();
  // const { sprints } = useSprints(); // Sprints removed
  const sheet = characterSheet;
  const streakDays = useMemo(() => calculateStreak(allTimeTasks), [allTimeTasks]);
  const { classTitle } = sheet;
  const dailyQuestClaimed = lastQuestClaimedAt != null && formatLocalDate(lastQuestClaimedAt) === MOCK_NOW;

  const notDone = tasks.filter((t) => t.status !== "done");
  const dueToday = notDone.filter((t) => isDueToday(t.dueDate, MOCK_NOW)).length;
  const overdue = notDone.filter((t) => isOverdue(t.dueDate, MOCK_NOW)).length;
  // Blocked/waiting_external removed in simplified status model
  const todaysQuest = notDone.filter((t) => isDueToday(t.dueDate, MOCK_NOW) || t.status === "in_progress");
  const recentWins = tasks
    .filter((t) => t.status === "done")
    .map((t) => ({ task: t, completedAt: completedAt(t) }))
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))
    .slice(0, 3);

  // Sprint removed
  // const activeSprint = sprints.find((s) => s.status === "active");
  // const sprintTasks = activeSprint ? tasks.filter((t) => t.sprint === activeSprint.name) : [];
  // const sprintDone = sprintTasks.filter((t) => t.status === "done").length;

  return (
    <main className="flex h-full flex-col gap-5 overflow-y-auto p-6">
      {/* Hero panel — docs/03-design.md §10 (level + XP bar + streak + coins) */}
      <div className="border-2 border-primary bg-card p-5">
        <div className="flex flex-wrap items-stretch gap-5">
          <div className="flex flex-col items-center justify-center border-r-2 border-border px-5">
            <div className="mb-1 text-sm tracking-widest text-muted-foreground">LEVEL</div>
            <div
              style={{ fontFamily: "var(--font-press-start), monospace", fontSize: "40px", color: "var(--color-xp-gold)", textShadow: "0 0 20px rgba(255,217,61,0.5)" }}
            >
              {sheet.globalLevel}
            </div>
            <div className="mt-1 border px-2 py-0.5 text-sm" style={{ borderColor: "var(--color-primary-gold)", color: "var(--color-primary-gold)" }}>
              {classTitle.toUpperCase()}
            </div>
          </div>

          <div className="flex min-w-[180px] flex-1 flex-col justify-center">
            <div className="mb-2 flex justify-between text-sm text-muted-foreground">
              <span>XP Progress</span>
              <span style={{ color: "var(--color-xp-gold)" }}>
                {sheet.xpIntoLevel.toLocaleString()} / {sheet.xpForNextLevel.toLocaleString()}
              </span>
            </div>
            <PixBar value={sheet.xpIntoLevel} max={sheet.xpForNextLevel} colorVar="--color-xp-gold" blocks={24} showLabel={false} />
            <div className="mt-1 text-sm text-muted-foreground">
              {Math.round((sheet.xpIntoLevel / sheet.xpForNextLevel) * 100)}% · {(sheet.xpForNextLevel - sheet.xpIntoLevel).toLocaleString()} XP to Lv.{sheet.globalLevel + 1}
            </div>
          </div>

          <div className="flex flex-col items-center justify-center border-l-2 border-border px-4">
            <StreakCampfire days={streakDays} />
          </div>

          <div className="flex flex-col items-center justify-center border-l-2 border-border px-4">
            <div className="mb-0.5 text-xl" aria-hidden>🪙</div>
            <div style={{ fontFamily: "var(--font-press-start), monospace", fontSize: "13px", color: "var(--color-coin)" }}>
              {sheet.totalCoins}
            </div>
            <div className="mt-0.5 text-sm text-muted-foreground">coins</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatPanel label="Due Today" value={dueToday} shape="◆" colorVar="--color-primary-gold" href="/tasks/today" />
        <StatPanel label="Overdue" value={overdue} shape="▲" colorVar="--color-status-blocked" href="/tasks/overdue" />
        {/* Blocked/Waiting removed in simplified status model */}
      </div>

      <DailyQuestCard
        tasks={tasks}
        claimed={dailyQuestClaimed}
        onClaim={() => {
          claimDailyQuest(MOCK_NOW, todaysDailyQuest.xp, todaysDailyQuest.coins);
        }}
      />

      <div className="grid gap-5 md:grid-cols-2">
        <section className="border-2 border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm tracking-widest" style={{ color: "var(--color-primary-gold)" }}>◆ TODAY&apos;S QUESTS</span>
          </div>
          <TaskListView tasks={todaysQuest} variant={compactView ? "compact" : "card"} empty="[ ALL CLEAR ]" />
        </section>

        <section className="border-2 border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm tracking-widest" style={{ color: "var(--color-status-blocked)" }}>✕ BLOCKED</span>
          </div>
          <TaskListView tasks={tasks.filter((t) => t.status === "in_progress").slice(0, 5)} empty="[ NONE ]" variant="compact" showStatus={false} />
        </section>
      </div>

      {/* Sprint removed */}

      {activityLogs && activityLogs.length > 0 && (
        <div className="border-2 border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2" title="Tracks: task created/completed/updated/deleted/focused, comments, projects, sprints">
            <span className="text-sm tracking-widest" style={{ color: "var(--color-primary-gold)" }}>◫ RECENT ACTIVITIES</span>
            <Info size={14} className="opacity-50" style={{ cursor: "help" }} />
          </div>
          <div className="flex flex-col gap-2">
            {activityLogs.map((log) => {
              const details = log.details as any;
              const getChangesSummary = () => {
                if (!details?.changes) return null;
                const changes = details.changes as Record<string, { from: any; to: any }>;
                const summary = Object.entries(changes)
                  .map(([key, value]) => {
                    if (key === "status") return `status ${value.from} → ${value.to}`;
                    if (key === "priority") return `priority to ${value.to}`;
                    if (key === "effort") return `effort to ${value.to}`;
                    if (key === "storyPoint") return `points to ${value.to}`;
                    if (key === "title") return `title`;
                    return null;
                  })
                  .filter(Boolean)
                  .join(", ");
                return summary ? `(${summary})` : null;
              };

              return (
                <div key={log.id} className="flex justify-between items-start text-xs border-b border-border/40 pb-1.5 last:border-b-0 last:pb-0 gap-2">
                  <div className="flex items-center gap-1.5 flex-1">
                    <span className="font-bold text-muted-foreground">{log.actorName}</span>
                    <span className="text-muted-foreground">{log.action}</span>
                    {getChangesSummary() && (
                      <span className="text-muted-foreground">{getChangesSummary()}</span>
                    )}
                    {log.taskTitle && (
                      <span className="text-foreground font-semibold truncate">&quot;{log.taskTitle}&quot;</span>
                    )}
                    {log.projectName && (
                      <span className="inline-flex items-center gap-1 text-foreground font-semibold">
                        <span>{log.projectEmoji}</span>
                        <span>{log.projectName}</span>
                      </span>
                    )}
                    {log.sprintName && (
                      <span className="text-foreground font-semibold">{log.sprintName}</span>
                    )}
                  </div>
                  <span className="text-muted-foreground shrink-0">{new Date(log.createdAt).toLocaleDateString()} {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {recentWins.length > 0 && (
        <div className="border-2 border-border bg-card p-4">
          <div className="mb-3 text-sm tracking-widest" style={{ color: "var(--color-status-ready)" }}>✓ RECENT WINS</div>
          {recentWins.map(({ task }) => {
            const xp = calcTaskXP(task.priority, task.size, isTaskOnTime(task));
            const coins = calcTaskCoins(task.priority, task.size);
            return (
              <div key={task.id} className="flex items-center gap-3 border-b border-border py-1.5">
                <span style={{ color: "var(--color-status-done)" }}>✓</span>
                <span className="text-sm">{TYPE_ICON[task.type]}</span>
                <span className="flex-1 truncate text-sm text-muted-foreground line-through">{task.title}</span>
                <span className="text-sm font-bold" style={{ color: "var(--color-xp-gold)" }}>+{xp} XP</span>
                <span className="text-sm" style={{ color: "var(--color-coin)" }}>+{coins}🪙</span>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
