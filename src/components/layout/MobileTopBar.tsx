"use client";

import { useMemo } from "react";
import { Plus } from "lucide-react";
import { useTasks } from "@/components/providers/TasksProvider";
import { calculateStreak } from "@/lib/gamification";

export function MobileTopBar() {
  const { characterSheet, allTimeTasks, openCreateForm } = useTasks();
  const streakDays = useMemo(() => calculateStreak(allTimeTasks), [allTimeTasks]);

  return (
    <header
      className="flex h-12 items-center justify-between px-3.5 lg:hidden shrink-0 select-none"
      style={{ borderBottom: "2px solid var(--color-border)", backgroundColor: "var(--color-bg-panel-alt)" }}
    >
      {/* Left: Brand Identity */}
      <div className="flex items-center gap-2">
        <span style={{ fontFamily: "var(--font-press-start), monospace", fontSize: "11px", color: "var(--color-primary-gold)" }}>
          ⚔ ATLAS
        </span>
      </div>

      {/* Right: Quick Telemetry + New Quest Button */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-2 text-xs font-mono">
          <span
            className="border px-1.5 py-0.5 font-bold text-[10px]"
            style={{ borderColor: "var(--color-primary-gold)", color: "var(--color-primary-gold)" }}
            title={`Level ${characterSheet.globalLevel}`}
          >
            L{characterSheet.globalLevel}
          </span>
          <span className="text-[11px]" style={{ color: "var(--color-streak-flame)" }} title={`${streakDays}d Streak`}>
            🔥{streakDays}
          </span>
          <span className="text-[11px]" style={{ color: "var(--color-coin)" }} title={`${characterSheet.totalCoins} Coins`}>
            🪙{characterSheet.totalCoins}
          </span>
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          aria-label="Create new quest"
          className="pixel-button flex items-center justify-center h-7 w-7 border-2 border-primary bg-primary text-black cursor-pointer font-bold"
        >
          <Plus size={14} />
        </button>
      </div>
    </header>
  );
}
