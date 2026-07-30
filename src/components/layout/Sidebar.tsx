"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { Companion } from "@/components/gamification/Companion";
import { XpBar } from "@/components/gamification/XpBar";
import { useTasks } from "@/components/providers/TasksProvider";
import { useCommandPalette } from "@/components/providers/CommandPaletteProvider";
import { computeCharacterSheet, getNextStreakMilestone } from "@/lib/gamification";
import { MOCK_NOW, dashboardMock } from "@/lib/mock-data";
import { NAV_CORE, NAV_MANAGE, NAV_SMART_VIEWS, NAV_TASKS, type NavItemBase } from "@/lib/nav-items";
import type { Task } from "@/types/task";

type NavItem = NavItemBase & {
  count?: number;
  badgeColorVar?: string;
};

const SMART_VIEW_BADGE_COLOR: Record<string, string> = {
  "/tasks/today": "--color-primary-gold",
  "/tasks/inbox": "--color-text-muted",
  "/tasks/waiting": "--color-status-waiting-external",
  "/tasks/focus": "--color-priority-p1",
};

const SMART_VIEW_COUNT: Record<string, (tasks: Task[]) => number> = {
  "/tasks/today": (tasks) => tasks.filter((t) => t.status !== "done" && (t.dueDate === MOCK_NOW || t.status === "in_progress")).length,
  "/tasks/inbox": (tasks) => tasks.filter((t) => t.status === "inbox").length,
  "/tasks/waiting": (tasks) => tasks.filter((t) => t.status === "waiting_external").length,
  "/tasks/focus": (tasks) => tasks.filter((t) => t.status === "ready" && (t.priority === "p0" || t.priority === "p1")).length,
};

function NavLink({ href, label, icon: Icon, count, badgeColorVar }: NavItem) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link
      href={href}
      className="flex w-full items-center gap-2 px-3 py-1 text-sm transition-all"
      style={{
        backgroundColor: active ? "var(--color-bg-panel)" : "transparent",
        color: active ? "var(--color-primary-gold)" : "var(--color-text-muted)",
        borderLeft: active ? "2px solid var(--color-primary-gold)" : "2px solid transparent",
      }}
    >
      <Icon size={12} />
      <span className="flex-1">{label}</span>
      {count !== undefined && count > 0 && (
        <span
          className="px-1 text-sm"
          style={{
            backgroundColor: "var(--color-bg-panel-alt)",
            border: "1px solid var(--color-border)",
            color: badgeColorVar ? `var(${badgeColorVar})` : "var(--color-primary-gold)",
          }}
        >
          {count}
        </span>
      )}
    </Link>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 py-1 text-sm tracking-widest" style={{ color: "var(--color-dim)" }}>
      ── {children} ──
    </div>
  );
}

export function Sidebar() {
  const { tasks, openCreateForm, justCompleted, bonusXp, bonusCoins } = useTasks();
  const { setOpen: setCommandPaletteOpen } = useCommandPalette();
  const sheet = useMemo(() => computeCharacterSheet(tasks, bonusXp, bonusCoins), [tasks, bonusXp, bonusCoins]);
  const milestone = getNextStreakMilestone(dashboardMock.streakDays);
  const pathname = usePathname();

  const smartViews: NavItem[] = NAV_SMART_VIEWS.map((item) => ({
    ...item,
    count: SMART_VIEW_COUNT[item.href]?.(tasks) ?? 0,
    badgeColorVar: SMART_VIEW_BADGE_COLOR[item.href],
  }));

  const tasksActive = pathname?.startsWith("/tasks") ?? false;

  return (
    <aside
      className="flex h-full w-52 shrink-0 flex-col overflow-y-auto border-r-2 border-border"
      style={{ backgroundColor: "var(--color-bg-panel-alt)" }}
    >
      <div className="px-4 py-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <div style={{ fontFamily: "var(--font-press-start), monospace", fontSize: "12px", color: "var(--color-primary-gold)" }}>
          ⚔ ATLAS
        </div>
        <div className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
          Your Second Brain
        </div>
      </div>

      {/* Compact XP strip — docs/03-design.md §10 ("compact" XpBar variant) */}
      <div className="flex flex-col gap-1.5 px-4 py-3" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <XpBar level={sheet.globalLevel} xpIntoLevel={sheet.xpIntoLevel} xpForNextLevel={sheet.xpForNextLevel} compact />
        <div className="flex items-center gap-3 text-sm">
          <span style={{ color: "var(--color-streak-flame)" }}>🔥 {dashboardMock.streakDays}d</span>
          <span style={{ color: "var(--color-coin)" }}>🪙 {sheet.totalCoins}</span>
        </div>
        {milestone && (
          <div className="mt-2 pt-2" style={{ borderTop: "1px solid var(--color-border)" }}>
            <div className="mb-1 flex justify-between text-sm" style={{ color: "var(--color-dim)" }}>
              <span style={{ color: "var(--color-text-muted)" }}>Next: {milestone.label}</span>
              <span style={{ color: "var(--color-streak-flame)" }}>{milestone.daysLeft}d</span>
            </div>
            <div className="flex gap-[2px]">
              {Array.from({ length: milestone.target }).map((_, i) => (
                <div
                  key={i}
                  className="h-1 flex-1"
                  style={{ backgroundColor: i < dashboardMock.streakDays ? "var(--color-streak-flame)" : "var(--color-border)" }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="px-3 py-2" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <button
          type="button"
          onClick={() => setCommandPaletteOpen(true)}
          className="flex w-full items-center gap-2 px-2 py-1 text-sm transition-colors"
          style={{
            backgroundColor: "var(--color-bg-panel)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-muted)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--color-primary-gold)";
            e.currentTarget.style.color = "var(--color-text)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--color-border)";
            e.currentTarget.style.color = "var(--color-text-muted)";
          }}
        >
          <Search size={10} />
          <span>Search... Ctrl+K</span>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-1">
        <GroupLabel>CORE</GroupLabel>
        {NAV_CORE.map((item) => (
          <NavLink key={item.href} {...item} />
        ))}
        <Link
          href={NAV_TASKS.href}
          className="flex w-full items-center gap-2 px-3 py-1 text-sm transition-all"
          style={{
            backgroundColor: tasksActive ? "var(--color-bg-panel)" : "transparent",
            color: tasksActive ? "var(--color-primary-gold)" : "var(--color-text-muted)",
            borderLeft: tasksActive ? "2px solid var(--color-primary-gold)" : "2px solid transparent",
          }}
        >
          <NAV_TASKS.icon size={12} />
          <span className="flex-1">{NAV_TASKS.label}</span>
        </Link>

        <div className="mt-1">
          <GroupLabel>SMART VIEWS</GroupLabel>
        </div>
        {smartViews.map((item) => (
          <NavLink key={item.href} {...item} />
        ))}

        <div className="mt-1">
          <GroupLabel>MANAGE</GroupLabel>
        </div>
        {NAV_MANAGE.map((item) => (
          <NavLink key={item.href} {...item} />
        ))}
      </nav>

      <Companion level={sheet.globalLevel} streakDays={dashboardMock.streakDays} justCompleted={justCompleted} />
      <div className="p-3">
        <button
          type="button"
          onClick={openCreateForm}
          className="pixel-button flex w-full items-center justify-center gap-1.5 border-2 border-primary bg-primary px-3 py-1.5 text-sm text-primary-foreground"
        >
          <Plus size={12} /> New Quest
        </button>
      </div>
    </aside>
  );
}
