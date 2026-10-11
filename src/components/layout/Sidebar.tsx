"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Moon, PanelLeftIcon, Plus, Search } from "lucide-react";
import { Companion } from "@/components/gamification/Companion";
import { SaveAndQuitOverlay } from "@/components/gamification/SaveAndQuitOverlay";
import { XpBar } from "@/components/gamification/XpBar";
import { useTasks } from "@/components/providers/TasksProvider";
import { useCommandPalette } from "@/components/providers/CommandPaletteProvider";
import { useSidebar } from "@/components/providers/SidebarProvider";
import { useNotifications } from "@/hooks/useNotifications";
import { getNextStreakMilestone, calculateStreak, completedAt, formatLocalDate } from "@/lib/gamification";
import { MOCK_NOW } from "@/lib/mock-data";
import { NAV_CORE, NAV_MANAGE, NAV_SMART_VIEWS, NAV_TASKS, type NavItemBase } from "@/lib/nav-items";
import { isOverdue } from "@/lib/task-utils";
import { cn } from "@/lib/utils";
import type { Task } from "@/types/task";

type NavItem = NavItemBase & {
  count?: number;
  badgeColorVar?: string;
};

const SMART_VIEW_BADGE_COLOR: Record<string, string> = {
  "/tasks/today": "--color-primary-gold",
  "/tasks/inbox": "--color-text-muted",
  "/tasks/overdue": "--color-status-blocked",
  "/tasks/focus": "--color-priority-p1",
};

const SMART_VIEW_COUNT: Record<string, (tasks: Task[]) => number> = {
  "/tasks/today": (tasks) => tasks.filter((t) => t.status !== "done" && (t.dueDate === MOCK_NOW || t.status === "in_progress")).length,
  "/tasks/inbox": (tasks) => tasks.filter((t) => t.status === "backlog").length,
  "/tasks/overdue": (tasks) => tasks.filter((t) => t.status !== "done" && isOverdue(t.dueDate, MOCK_NOW)).length,
  "/tasks/focus": (tasks) => tasks.filter((t) => (t.status === "todo" || t.status === "in_progress") && (t.priority === "high" || t.priority === "medium")).length,
};

function NavLink({ href, label, icon: Icon, count, badgeColorVar, collapsed }: NavItem & { collapsed?: boolean }) {
  const pathname = usePathname();
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);

  useEffect(() => {
    setNavigatingTo(null);
  }, [pathname]);

  const active = (navigatingTo ?? pathname) === href;

  return (
    <div className="relative group w-full">
      <Link
        href={href}
        prefetch={true}
        onClick={() => setNavigatingTo(href)}
        className={cn(
          "flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-all",
          collapsed ? "lg:justify-center lg:px-0 lg:py-2" : "hover:translate-x-0.5"
        )}
        style={{
          backgroundColor: active ? "var(--color-bg-panel)" : "transparent",
          color: active ? "var(--color-primary-gold)" : "var(--color-text-muted)",
          borderLeft: active ? "3px solid var(--color-primary-gold)" : "3px solid transparent",
        }}
      >
        <div className="relative flex items-center justify-center shrink-0">
          <Icon size={collapsed ? 16 : 13} />
          {collapsed && count !== undefined && count > 0 && (
            <span
              className="absolute -top-1.5 -right-2 flex h-3.5 min-w-[14px] items-center justify-center px-0.5 text-[9px] font-bold font-mono"
              style={{
                backgroundColor: badgeColorVar ? `var(${badgeColorVar})` : "var(--color-primary-gold)",
                color: "#000",
              }}
            >
              {count > 9 ? "9+" : count}
            </span>
          )}
        </div>
        {!collapsed && <span className="flex-1 truncate">{label}</span>}
        {!collapsed && count !== undefined && count > 0 && (
          <span
            className="px-1 text-[11px] font-mono"
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

      {/* Floating Pixel Tooltip for Collapsed State */}
      {collapsed && (
        <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 hidden z-50 whitespace-nowrap border-2 border-border bg-[var(--color-bg-panel)] px-2.5 py-1 text-xs text-foreground shadow-[3px_3px_0_rgba(0,0,0,0.8)] group-hover:flex items-center gap-2">
          <span className="font-bold">{label}</span>
          {count !== undefined && count > 0 && (
            <span
              className="px-1 text-[10px] font-mono font-bold"
              style={{
                backgroundColor: "var(--color-bg-panel-alt)",
                border: "1px solid var(--color-border)",
                color: badgeColorVar ? `var(${badgeColorVar})` : "var(--color-primary-gold)",
              }}
            >
              {count}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function GroupLabel({ children, collapsed }: { children: React.ReactNode; collapsed?: boolean }) {
  return (
    <div className={cn("px-3 py-1 text-[10px] font-mono tracking-widest uppercase", collapsed && "lg:hidden")} style={{ color: "var(--color-dim)" }}>
      ── {children} ──
    </div>
  );
}

export function Sidebar() {
  const router = useRouter();
  const { tasks, allTimeTasks, characterSheet, openCreateForm, openEditForm, justCompleted, togglePin } = useTasks();
  const { collapsed, setCollapsed, mobileOpen, setMobileOpen } = useSidebar();
  const [showQuit, setShowQuit] = useState(false);
  const { setOpen: setCommandPaletteOpen } = useCommandPalette();
  const pathname = usePathname();

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  const sheet = characterSheet;
  const streakDays = useMemo(() => calculateStreak(allTimeTasks), [allTimeTasks]);
  const todayCompletedCount = useMemo(() => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    return tasks.filter((t) => {
      if (t.status !== "done") return false;
      const doneAt = completedAt(t);
      return doneAt ? formatLocalDate(doneAt) === todayStr : false;
    }).length;
  }, [tasks]);
  const pinnedTasks = useMemo(() => tasks.filter((t) => t.pinned), [tasks]);
  const milestone = getNextStreakMilestone(streakDays);

  const smartViews: NavItem[] = NAV_SMART_VIEWS.map((item) => ({
    ...item,
    count: SMART_VIEW_COUNT[item.href]?.(tasks) ?? 0,
    badgeColorVar: SMART_VIEW_BADGE_COLOR[item.href],
  }));

  const tasksActive = pathname === "/tasks";

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-full shrink-0 flex-col overflow-y-auto border-r-2 border-border transition-all duration-200 lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "w-64 lg:w-16" : "w-64 lg:w-56"
        )}
        style={{ backgroundColor: "var(--color-bg-panel-alt)", overflowX: "visible" }}
      >
        {/* Header */}
        <div className="flex h-12 items-center justify-between px-3 border-b border-border">
          {collapsed ? (
            <div className="flex w-full items-center justify-center">
              <button
                type="button"
                onClick={() => setCollapsed(false)}
                className="flex items-center justify-center p-1 text-[var(--color-primary-gold)] hover:scale-110 transition-transform cursor-pointer"
                title="Expand sidebar (Click to expand)"
              >
                <span style={{ fontFamily: "var(--font-press-start), monospace", fontSize: "14px" }}>⚔</span>
              </button>
            </div>
          ) : (
            <>
              <div>
                <div style={{ fontFamily: "var(--font-press-start), monospace", fontSize: "11px", color: "var(--color-primary-gold)" }}>
                  ⚔ ATLAS
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Your Second Brain</div>
              </div>
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                aria-label="Collapse sidebar"
                className="hidden shrink-0 items-center justify-center p-1 text-muted-foreground hover:text-foreground lg:flex cursor-pointer"
              >
                <PanelLeftIcon size={14} />
              </button>
            </>
          )}
        </div>

        {/* Collapsed mini status telemetry */}
        {collapsed && (
          <div className="hidden lg:flex flex-col items-center gap-1.5 py-2.5 border-b border-border text-center">
            <span
              className="font-mono text-[10px] font-bold text-[var(--color-primary-gold)] px-1 py-0.5 border border-[var(--color-primary-gold)]/40 bg-[var(--color-bg-panel)]"
              title={`Level ${sheet.globalLevel} ${sheet.classTitle}`}
            >
              L{sheet.globalLevel}
            </span>
            <span className="text-[10px] text-[var(--color-streak-flame)] font-mono" title={`${streakDays}d Streak`}>
              🔥{streakDays}
            </span>
            <span className="text-[10px] text-[var(--color-coin)] font-mono" title={`${sheet.totalCoins} Coins`}>
              🪙{sheet.totalCoins > 999 ? `${Math.floor(sheet.totalCoins / 1000)}k` : sheet.totalCoins}
            </span>
          </div>
        )}

        {/* Expanded XP bar and stats */}
        {!collapsed && (
          <div className="flex flex-col gap-1.5 px-3 py-2.5 border-b border-border">
            <XpBar level={sheet.globalLevel} xpIntoLevel={sheet.xpIntoLevel} xpForNextLevel={sheet.xpForNextLevel} compact />
            <div className="flex items-center gap-3 text-xs">
              <span
                title={todayCompletedCount === 0 ? "Complete a quest today to keep your streak!" : "Streak active!"}
                style={{
                  color: todayCompletedCount === 0 ? "var(--color-dim)" : "var(--color-streak-flame)",
                  cursor: "help",
                }}
              >
                <span style={{ filter: todayCompletedCount === 0 ? "grayscale(1) opacity(0.5)" : "none", display: "inline-block" }}>🔥</span> {streakDays}d
              </span>
              <span style={{ color: "var(--color-coin)" }}>🪙 {sheet.totalCoins}</span>
            </div>
            {milestone && (
              <div className="mt-1 pt-1.5 border-t border-border">
                <div className="mb-1 flex justify-between text-[11px]" style={{ color: "var(--color-dim)" }}>
                  <span style={{ color: "var(--color-text-muted)" }}>Next: {milestone.label}</span>
                  <span style={{ color: "var(--color-streak-flame)" }}>{milestone.daysLeft}d</span>
                </div>
                <div className="flex gap-[2px]">
                  {Array.from({ length: milestone.target }).map((_, i) => (
                    <div
                      key={i}
                      className="h-1 flex-1"
                      style={{ backgroundColor: i < streakDays ? "var(--color-streak-flame)" : "var(--color-border)" }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Search */}
        <div className="px-2 py-1.5 border-b border-border">
          {collapsed ? (
            <div className="relative group flex justify-center">
              <button
                type="button"
                onClick={() => setCommandPaletteOpen(true)}
                className="flex items-center justify-center p-2 text-muted-foreground hover:text-foreground hover:border-[var(--color-primary-gold)] border border-transparent transition-colors cursor-pointer"
                aria-label="Search"
              >
                <Search size={14} />
              </button>
              <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 hidden z-50 whitespace-nowrap border-2 border-border bg-[var(--color-bg-panel)] px-2 py-1 text-xs text-foreground shadow-[3px_3px_0_rgba(0,0,0,0.8)] group-hover:block">
                Search (Ctrl+K)
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCommandPaletteOpen(true)}
              className="flex w-full items-center gap-2 px-2 py-1 text-xs transition-colors cursor-pointer"
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
              <Search size={11} />
              <span>Search... Ctrl+K</span>
            </button>
          )}
        </div>

        {/* Navigation items */}
        <nav className="flex-1 overflow-y-auto py-1">
          <GroupLabel collapsed={collapsed}>CORE</GroupLabel>
          {NAV_CORE.map((item) => (
            <NavLink key={item.href} {...item} collapsed={collapsed} />
          ))}

          <div className="relative group w-full">
            <Link
              href={NAV_TASKS.href}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-all",
                collapsed ? "lg:justify-center lg:px-0 lg:py-2" : "hover:translate-x-0.5"
              )}
              style={{
                backgroundColor: tasksActive ? "var(--color-bg-panel)" : "transparent",
                color: tasksActive ? "var(--color-primary-gold)" : "var(--color-text-muted)",
                borderLeft: tasksActive ? "3px solid var(--color-primary-gold)" : "3px solid transparent",
              }}
            >
              <NAV_TASKS.icon size={collapsed ? 16 : 13} />
              {!collapsed && <span className="flex-1 truncate">{NAV_TASKS.label}</span>}
            </Link>
            {collapsed && (
              <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 hidden z-50 whitespace-nowrap border-2 border-border bg-[var(--color-bg-panel)] px-2 py-1 text-xs text-foreground shadow-[3px_3px_0_rgba(0,0,0,0.8)] group-hover:block">
                {NAV_TASKS.label}
              </div>
            )}
          </div>

          <div className="mt-1">
            <GroupLabel collapsed={collapsed}>SMART VIEWS</GroupLabel>
          </div>
          {smartViews.map((item) => (
            <NavLink key={item.href} {...item} collapsed={collapsed} />
          ))}

          <div className="mt-1">
            <GroupLabel collapsed={collapsed}>MANAGE</GroupLabel>
          </div>
          {NAV_MANAGE.map((item) => (
            <NavLink key={item.href} {...item} collapsed={collapsed} />
          ))}
        </nav>

        {/* Pip Companion */}
        {!collapsed && (
          <div>
            <Companion
              level={sheet.globalLevel}
              todayCompleted={todayCompletedCount}
              justCompleted={justCompleted}
              pinnedTasks={pinnedTasks}
              onOpenTask={(task) => openEditForm(task)}
              onUnpinTask={(taskId) => togglePin(taskId, false)}
            />
          </div>
        )}

        {/* Footer actions */}
        <div className={cn("p-2 border-t border-border flex flex-col gap-1.5", collapsed && "items-center px-1.5")}>
          <div className="relative group w-full flex justify-center">
            <button
              type="button"
              onClick={openCreateForm}
              className={cn(
                "pixel-button flex items-center justify-center gap-1.5 border-2 border-primary bg-primary text-xs font-bold text-primary-foreground cursor-pointer",
                collapsed ? "h-9 w-9 p-0" : "w-full px-3 py-1.5"
              )}
            >
              <Plus size={collapsed ? 16 : 13} />
              {!collapsed && <span>New Quest</span>}
            </button>
            {collapsed && (
              <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 hidden z-50 whitespace-nowrap border-2 border-border bg-[var(--color-bg-panel)] px-2 py-1 text-xs text-foreground shadow-[3px_3px_0_rgba(0,0,0,0.8)] group-hover:block">
                New Quest (Ctrl+N)
              </div>
            )}
          </div>

          <div className="relative group w-full flex justify-center">
            <button
              type="button"
              onClick={() => setShowQuit(true)}
              className={cn(
                "pixel-button flex items-center justify-center gap-1.5 border-2 border-border bg-transparent text-xs text-muted-foreground hover:text-foreground hover:border-[var(--color-primary-gold)] transition-colors cursor-pointer",
                collapsed ? "h-9 w-9 p-0" : "w-full px-3 py-1.5"
              )}
            >
              <Moon size={collapsed ? 15 : 12} />
              {!collapsed && <span>Save &amp; Quit</span>}
            </button>
            {collapsed && (
              <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 hidden z-50 whitespace-nowrap border-2 border-border bg-[var(--color-bg-panel)] px-2 py-1 text-xs text-foreground shadow-[3px_3px_0_rgba(0,0,0,0.8)] group-hover:block">
                Save &amp; Quit
              </div>
            )}
          </div>
        </div>
      </aside>
      {showQuit && <SaveAndQuitOverlay onClose={() => setShowQuit(false)} />}
    </>
  );
}
