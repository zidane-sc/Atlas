"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import { XpBar } from "@/components/gamification/XpBar";
import { useTasks } from "@/components/providers/TasksProvider";
import { computeCharacterSheet, calculateStreak, getNextStreakMilestone, completedAt, formatLocalDate } from "@/lib/gamification";

export function HudNavbar({
  user,
}: {
  user: { name?: string | null; email?: string | null };
}) {
  const { tasks, bonusXp, bonusCoins } = useTasks();
  const pathname = usePathname();

  const sheet = useMemo(() => computeCharacterSheet(tasks, bonusXp, bonusCoins), [tasks, bonusXp, bonusCoins]);
  const streakDays = useMemo(() => calculateStreak(tasks), [tasks]);
  const milestone = getNextStreakMilestone(streakDays);

  const todayCompletedCount = useMemo(() => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    return tasks.filter((t) => {
      if (t.status !== "done") return false;
      const doneAt = completedAt(t);
      return doneAt ? formatLocalDate(doneAt) === todayStr : false;
    }).length;
  }, [tasks]);

  const streakFired = todayCompletedCount > 0;
  const initial = (user?.name || user?.email || "?").charAt(0).toUpperCase();

  return (
    <div
      className="flex h-14 shrink-0 items-center justify-between gap-4 border-b-2 border-border px-4"
      style={{ backgroundColor: "var(--color-bg-panel-alt)" }}
    >
      {/* XP readout */}
      <div className="flex items-center gap-3">
        <XpBar
          level={sheet.globalLevel}
          xpIntoLevel={sheet.xpIntoLevel}
          xpForNextLevel={sheet.xpForNextLevel}
          density="navbar"
        />
      </div>

      {/* Streak + milestone */}
      <div className="flex items-center gap-3">
        <span
          title={streakFired ? "Streak active!" : "You need to complete a task today to fire the streak!"}
          style={{
            color: streakFired ? "var(--color-streak-flame)" : "var(--color-dim)",
            cursor: "help",
          }}
        >
          <span style={{ filter: streakFired ? "none" : "grayscale(1) opacity(0.5)", display: "inline-block" }}>🔥</span>{" "}
          <span className="font-display text-[10px]">{streakDays}d</span>
        </span>
        {milestone && (
          <div className="hidden md:block">
            <div className="mb-0.5 flex justify-between text-[10px]" style={{ color: "var(--color-dim)" }}>
              <span style={{ color: "var(--color-text-muted)" }}>Next: {milestone.label}</span>
              <span style={{ color: "var(--color-streak-flame)" }}>{milestone.daysLeft}d</span>
            </div>
            <div className="flex gap-[2px]">
              {Array.from({ length: milestone.target }).map((_, i) => (
                <div
                  key={i}
                  className="h-1 w-1.5"
                  style={{ backgroundColor: i < streakDays ? "var(--color-streak-flame)" : "var(--color-border)" }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Coins */}
      <div className="flex items-center gap-1.5 text-sm" style={{ color: "var(--color-coin)" }}>
        <span aria-hidden>🪙</span>
        <span className="font-display text-[10px]">{sheet.totalCoins.toLocaleString()}</span>
      </div>

      {/* User */}
      <div className="flex items-center gap-2">
        <div
          className="flex h-7 w-7 items-center justify-center border-2 font-display text-[10px]"
          style={{
            borderColor: "var(--color-border)",
            backgroundColor: "var(--color-bg-panel)",
            color: "var(--color-primary-gold)",
          }}
          title={user?.email ?? user?.name ?? ""}
        >
          {initial}
        </div>
        <Link
          href="/settings"
          className="flex h-7 w-7 items-center justify-center border-2 transition-colors"
          style={{
            borderColor: pathname === "/settings" ? "var(--color-primary-gold)" : "var(--color-border)",
            color: pathname === "/settings" ? "var(--color-primary-gold)" : "var(--color-text-muted)",
          }}
          aria-label="Settings"
        >
          <Settings size={14} />
        </Link>
      </div>
    </div>
  );
}
