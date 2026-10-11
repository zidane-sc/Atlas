"use client";

import { useMemo } from "react";
import { Menu, Plus } from "lucide-react";
import { useSidebar } from "@/components/providers/SidebarProvider";
import { useTasks } from "@/components/providers/TasksProvider";
import { calculateStreak } from "@/lib/gamification";

export function MobileTopBar() {
  const { setMobileOpen } = useSidebar();
  const { characterSheet, allTimeTasks, openCreateForm } = useTasks();
  const streakDays = useMemo(() => calculateStreak(allTimeTasks), [allTimeTasks]);

  return (
    <header
      className="flex h-12 items-center justify-between px-3 lg:hidden shrink-0"
      style={{ borderBottom: "2px solid var(--color-border)", backgroundColor: "var(--color-bg-panel-alt)" }}
    >
      {/* Left: Hamburger menu + Title */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
          className="flex items-center justify-center p-1.5 text-muted-foreground hover:text-foreground border border-border bg-card"
        >
          <Menu size={16} />
        </button>
        <span style={{ fontFamily: "var(--font-press-start), monospace", fontSize: "11px", color: "var(--color-primary-gold)" }}>
          ⚔ ATLAS
        </span>
      </div>

      {/* Right: Quick Telemetry + New Quest Button */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 text-xs font-mono">
          <span
            className="border px-1 py-0.5 font-bold text-[10px]"
            style={{ borderColor: "var(--color-primary-gold)", color: "var(--color-primary-gold)" }}
          >
            L{characterSheet.globalLevel}
          </span>
          <span className="text-[11px]" style={{ color: "var(--color-streak-flame)" }}>
            🔥{streakDays}
          </span>
          <span className="text-[11px]" style={{ color: "var(--color-coin)" }}>
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
