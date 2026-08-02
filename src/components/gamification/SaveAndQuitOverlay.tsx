"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { useTasks } from "@/components/providers/TasksProvider";
import {
  calcTaskXP,
  calculateStreak,
  completedAt,
  computeCharacterSheet,
  formatLocalDate,
  getFarewell,
  isTaskOnTime,
  type CompanionMood,
} from "@/lib/gamification";

const MOOD_COLOR_VAR: Record<CompanionMood, string> = {
  excited: "--color-xp-gold",
  happy: "--color-status-ready",
  idle: "--color-primary-gold",
  sad: "--color-status-waiting-external",
};

function todayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function StatCard({
  icon,
  value,
  label,
  colorVar,
  dim = false,
}: {
  icon: string;
  value: number | string;
  label: string;
  colorVar: string;
  dim?: boolean;
}) {
  return (
    <div
      className="bg-card p-5 text-center"
      style={{
        border: `2px solid var(${colorVar})`,
        opacity: dim ? 0.55 : 1,
      }}
    >
      <div className="font-display text-xl leading-none" style={{ color: `var(${colorVar})` }}>
        {icon} {value}
      </div>
      <div className="mt-2 text-sm tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}

export function SaveAndQuitOverlay({ onClose }: { onClose: () => void }) {
  const { tasks, allTimeTasks } = useTasks();
  const [saving, setSaving] = useState(false);
  const [serverStats, setServerStats] = useState<{ bonusXp: number; bonusCoins: number } | null>(null);
  const savingRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);
  const quitRef = useRef<HTMLButtonElement>(null);
  const today = useMemo(() => todayStr(), []);

  useEffect(() => {
    const fetchStats = async () => {
      const { getUserStatsAction } = await import("@/lib/actions/user");
      const result = await getUserStatsAction();
      if (result.success) {
        setServerStats(result.data);
      }
    };
    void fetchStats();
  }, []);

  const todayCompletedCount = useMemo(
    () =>
      tasks.filter((t) => {
        if (t.status !== "done") return false;
        const at = completedAt(t);
        return at ? formatLocalDate(at) === today : false;
      }).length,
    [tasks, today]
  );

  const todayXp = useMemo(
    () =>
      tasks.reduce((sum, t) => {
        if (t.status !== "done") return sum;
        const at = completedAt(t);
        if (!at || formatLocalDate(at) !== today) return sum;
        return sum + calcTaskXP(t.priority, t.storyPoint, isTaskOnTime(t));
      }, 0),
    [tasks, today]
  );

  const streakDays = useMemo(() => calculateStreak(tasks), [tasks]);
  const totalCoins = useMemo(
    () => {
      if (!serverStats) return 0;
      return computeCharacterSheet(allTimeTasks, serverStats.bonusXp, serverStats.bonusCoins).totalCoins;
    },
    [allTimeTasks, serverStats]
  );

  const farewell = getFarewell(todayCompletedCount, streakDays);
  const colorVar = MOOD_COLOR_VAR[farewell.mood];

  useEffect(() => {
    quitRef.current?.focus();
  }, []);

  const handleQuit = useCallback(() => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    timeoutRef.current = window.setTimeout(() => signOut(), 600);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter") handleQuit();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, handleQuit]);

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center"
      style={{ backgroundColor: "rgba(5,7,12,0.97)" }}
      role="dialog"
      aria-modal
      aria-label="Save and quit"
    >
      {/* scanlines overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.18) 3px, rgba(0,0,0,0.18) 4px)",
          zIndex: 1,
        }}
      />

      <div className="relative z-10 flex w-full max-w-lg flex-col items-center gap-6 px-6">
        <div className="text-center">
          <div className="font-display mb-2.5 text-[9px]" style={{ color: "var(--color-text-muted)" }}>
            ◈ SAVE &amp; QUIT
          </div>
          <div
            className="font-display text-[22px]"
            style={{
              color: "var(--color-primary-gold)",
              textShadow: "0 0 30px rgba(240,180,41,0.4)",
              letterSpacing: "0.15em",
            }}
          >
            SAVE GAME
          </div>
          <div className="mt-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
            Atlas saves your progress. Your quest resumes tomorrow.
          </div>
        </div>

        <div className="grid w-full grid-cols-2 gap-3">
          <StatCard icon="🗡" value={todayCompletedCount} label="QUESTS DONE" colorVar="--color-status-ready" />
          <StatCard icon="✦" value={todayXp} label="XP EARNED" colorVar="--color-xp-gold" />
          <StatCard
            icon="🔥"
            value={`${streakDays}d`}
            label="DAY STREAK"
            colorVar="--color-streak-flame"
            dim={todayCompletedCount === 0}
          />
          <StatCard icon="🪙" value={totalCoins} label="COINS" colorVar="--color-coin" />
        </div>

        <div
          className="flex w-full items-center gap-4 bg-card px-5 py-4"
          style={{
            border: `2px solid var(${colorVar})`,
            boxShadow: `0 0 16px color-mix(in srgb, var(${colorVar}) 25%, transparent)`,
          }}
        >
          <div className="text-2xl" style={{ color: `var(${colorVar})` }}>
            👾
          </div>
          <div>
            <div className="font-display text-[7px]" style={{ color: `var(${colorVar})` }}>
              PIP · {farewell.mood.toUpperCase()}
            </div>
            <div className="mt-1 text-sm" style={{ color: "var(--color-text)" }}>
              {farewell.line}
            </div>
          </div>
        </div>

        {saving && (
          <div
            className="font-display text-[8px]"
            style={{ color: "var(--color-primary-gold)", animation: "pixelPulse 0.4s ease-in-out infinite" }}
          >
            SAVING PROGRESS...
          </div>
        )}

        <div className="flex gap-4">
          <button
            type="button"
            onClick={onClose}
            className="pixel-button border-2 border-border bg-transparent px-6 py-2 text-sm"
            style={{ color: "var(--color-text-muted)" }}
          >
            ◄ CANCEL
          </button>
          <button
            ref={quitRef}
            type="button"
            onClick={handleQuit}
            className="pixel-button border-2 border-primary bg-primary px-6 py-2 text-sm text-primary-foreground"
          >
            Zzz QUIT
          </button>
        </div>
      </div>
    </div>
  );
}
