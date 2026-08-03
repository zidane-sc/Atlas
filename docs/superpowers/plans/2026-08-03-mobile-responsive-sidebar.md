# Mobile-Responsive Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the dashboard sidebar collapsible on desktop (icon rail) and a slide-in drawer on mobile, and fix the two components that overflow/break on a narrow viewport, with zero new dependencies.

**Architecture:** A new `SidebarProvider` React context holds two booleans — `collapsed` (desktop icon-rail toggle, persisted to `localStorage`) and `mobileOpen` (drawer open/closed, ephemeral, auto-closes on route change). `Sidebar.tsx` becomes `fixed` + translate-x driven below the `lg` breakpoint (drawer) and `static` + width-driven at `lg`+ (icon rail). A new `MobileTopBar` gives mobile users a hamburger to open the drawer, since no header exists today.

**Tech Stack:** Next.js (App Router), React context + hooks, Tailwind CSS (default breakpoints), `lucide-react` icons (already a dependency). No new packages.

**Design doc:** `docs/superpowers/specs/2026-08-03-mobile-responsive-sidebar-design.md`

## Global Constraints

- Breakpoint split is Tailwind's default `lg` (1024px) — below it, sidebar is a drawer; at/above it, sidebar is static and collapsible to an icon rail.
- `localStorage` key for desktop collapse state: `atlas.sidebar.collapsed` (exact string, read/written only through `src/lib/sidebar-storage.ts`).
- No new npm dependencies. No jsdom/`@testing-library` in this repo (`vitest.config.ts` uses `environment: "node"`) — component-level UI behavior (drawer transform, backdrop click, Escape-to-close) is verified manually via the dev server, not automated. Only pure-logic modules (no hooks, no JSX) get real `vitest` unit tests, matching the existing convention in `src/lib/*.test.ts`.
- `cn` class-merge helper already exists at `src/lib/utils.ts` — use it instead of manual string concatenation for conditional classes.
- Any element that must hide only in the desktop-collapsed rail (never on mobile, where the drawer always shows full content) gets the Tailwind class `lg:hidden` gated on `collapsed` — never a bare `hidden`, which would also hide it on mobile.

---

### Task 1: Sidebar collapse persistence helper

**Files:**
- Create: `src/lib/sidebar-storage.ts`
- Test: `src/lib/sidebar-storage.test.ts`

**Interfaces:**
- Produces: `getStoredSidebarCollapsed(): boolean`, `setStoredSidebarCollapsed(collapsed: boolean): void` — consumed by `SidebarProvider` in Task 2.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/sidebar-storage.test.ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getStoredSidebarCollapsed, setStoredSidebarCollapsed } from "./sidebar-storage";

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    get length() {
      return store.size;
    },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
  };
}

describe("sidebar-storage", () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    (globalThis as any).window = { localStorage: createMemoryStorage() };
  });

  afterEach(() => {
    (globalThis as any).window = originalWindow;
  });

  it("defaults to false when nothing stored", () => {
    expect(getStoredSidebarCollapsed()).toBe(false);
  });

  it("round-trips true", () => {
    setStoredSidebarCollapsed(true);
    expect(getStoredSidebarCollapsed()).toBe(true);
  });

  it("round-trips back to false", () => {
    setStoredSidebarCollapsed(true);
    setStoredSidebarCollapsed(false);
    expect(getStoredSidebarCollapsed()).toBe(false);
  });

  it("returns false when window is undefined (SSR)", () => {
    (globalThis as any).window = undefined;
    expect(getStoredSidebarCollapsed()).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/sidebar-storage.test.ts`
Expected: FAIL — `Cannot find module './sidebar-storage'` (file doesn't exist yet).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/sidebar-storage.ts
const STORAGE_KEY = "atlas.sidebar.collapsed";

export function getStoredSidebarCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function setStoredSidebarCollapsed(collapsed: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, collapsed ? "true" : "false");
  } catch {
    // localStorage unavailable (private mode, quota) — collapse state just won't persist
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/sidebar-storage.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/sidebar-storage.ts src/lib/sidebar-storage.test.ts
git commit -m "feat: add sidebar collapse persistence helper"
```

---

### Task 2: `SidebarProvider` context

**Files:**
- Create: `src/components/providers/SidebarProvider.tsx`

**Interfaces:**
- Consumes: `getStoredSidebarCollapsed`, `setStoredSidebarCollapsed` from Task 1 (`@/lib/sidebar-storage`).
- Produces: `useSidebar(): { collapsed: boolean; setCollapsed: (v: boolean) => void; mobileOpen: boolean; setMobileOpen: (v: boolean) => void }` and `<SidebarProvider>` wrapper — consumed by `Sidebar.tsx` (Task 3), `MobileTopBar.tsx` (Task 4), and `layout.tsx` (Task 5).

No automated test — this is a hook/context component with no DOM rendering harness in this repo (see Global Constraints). Verified manually once wired into the layout in Task 5.

- [ ] **Step 1: Write the provider**

```tsx
// src/components/providers/SidebarProvider.tsx
"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getStoredSidebarCollapsed, setStoredSidebarCollapsed } from "@/lib/sidebar-storage";

interface SidebarContextValue {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }
  return context;
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsedState] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setCollapsedState(getStoredSidebarCollapsed());
  }, []);

  const setCollapsed = (value: boolean) => {
    setCollapsedState(value);
    setStoredSidebarCollapsed(value);
  };

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed, mobileOpen, setMobileOpen }}>
      {children}
    </SidebarContext.Provider>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no new errors from this file (it isn't imported anywhere yet, so this just catches syntax/type mistakes in isolation).

- [ ] **Step 3: Commit**

```bash
git add src/components/providers/SidebarProvider.tsx
git commit -m "feat: add SidebarProvider context for collapse/drawer state"
```

---

### Task 3: `MobileTopBar` component

**Files:**
- Create: `src/components/layout/MobileTopBar.tsx`

**Interfaces:**
- Consumes: `useSidebar()` from Task 2 (`@/components/providers/SidebarProvider`) — only `setMobileOpen`.
- Produces: `<MobileTopBar />` — consumed by `layout.tsx` (Task 5).

No automated test (pure presentational client component, no DOM harness). Verified manually in Task 5.

- [ ] **Step 1: Write the component**

```tsx
// src/components/layout/MobileTopBar.tsx
"use client";

import { Menu } from "lucide-react";
import { useSidebar } from "@/components/providers/SidebarProvider";

export function MobileTopBar() {
  const { setMobileOpen } = useSidebar();

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 lg:hidden"
      style={{ borderBottom: "2px solid var(--color-border)", backgroundColor: "var(--color-bg-panel-alt)" }}
    >
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
        className="flex items-center justify-center p-1"
        style={{ color: "var(--color-text-muted)" }}
      >
        <Menu size={18} />
      </button>
      <div style={{ fontFamily: "var(--font-press-start), monospace", fontSize: "12px", color: "var(--color-primary-gold)" }}>
        ⚔ ATLAS
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/MobileTopBar.tsx
git commit -m "feat: add MobileTopBar with hamburger to open sidebar drawer"
```

---

### Task 4: Make `Sidebar.tsx` collapsible + drawer-capable

**Files:**
- Modify: `src/components/layout/Sidebar.tsx` (entire file — replace with the version below)

**Interfaces:**
- Consumes: `useSidebar()` from Task 2 (`@/components/providers/SidebarProvider`), `cn` from `@/lib/utils`.
- Produces: no new exports — `Sidebar` export signature (`export function Sidebar()`) unchanged, still consumed by `layout.tsx`.

No automated test (client component, hooks, no DOM harness). Verified manually in Task 5's manual-verification step, which covers the whole wired-up layout.

- [ ] **Step 1: Replace the file contents**

Replace all of `src/components/layout/Sidebar.tsx` with:

```tsx
"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
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
import { updateTask as updateTaskAction } from "@/lib/actions/tasks";
import { updateNoteAction } from "@/lib/actions/notes";
import { listNotesAction } from "@/lib/actions/notes";
import { MOCK_NOW } from "@/lib/mock-data";
import { NAV_CORE, NAV_MANAGE, NAV_SMART_VIEWS, NAV_TASKS, type NavItemBase } from "@/lib/nav-items";
import { isOverdue } from "@/lib/task-utils";
import { cn } from "@/lib/utils";
import type { Task } from "@/types/task";
import type { NotePreview } from "@/types/note";

type NavItem = NavItemBase & {
  count?: number;
  badgeColorVar?: string;
};

const SMART_VIEW_BADGE_COLOR: Record<string, string> = {
  "/tasks/today": "--color-primary-gold",
  "/tasks/inbox": "--color-text-muted",
  "/tasks/overdue": "--color-status-blocked",
  "/tasks/waiting": "--color-status-waiting-external",
  "/tasks/focus": "--color-priority-p1",
};

const SMART_VIEW_COUNT: Record<string, (tasks: Task[]) => number> = {
  "/tasks/today": (tasks) => tasks.filter((t) => t.status !== "done" && (t.dueDate === MOCK_NOW || t.status === "in_progress")).length,
  "/tasks/inbox": (tasks) => tasks.filter((t) => t.status === "inbox").length,
  "/tasks/overdue": (tasks) => tasks.filter((t) => t.status !== "done" && isOverdue(t.dueDate, MOCK_NOW)).length,
  "/tasks/waiting": (tasks) => tasks.filter((t) => t.status === "waiting_external").length,
  "/tasks/focus": (tasks) => tasks.filter((t) => t.status === "ready" && (t.priority === "p0" || t.priority === "p1")).length,
};

function NavLink({ href, label, icon: Icon, count, badgeColorVar, collapsed }: NavItem & { collapsed?: boolean }) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className="flex w-full items-center gap-2 px-3 py-1 text-sm transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 rounded-sm"
      style={{
        backgroundColor: active ? "var(--color-bg-panel)" : "transparent",
        color: active ? "var(--color-primary-gold)" : "var(--color-text-muted)",
        borderLeft: active ? "2px solid var(--color-primary-gold)" : "2px solid transparent",
        outlineColor: "var(--color-primary-gold)",
      }}
    >
      <Icon size={12} />
      <span className={cn("flex-1", collapsed && "lg:hidden")}>{label}</span>
      {count !== undefined && count > 0 && (
        <span
          className={cn("px-1 text-sm", collapsed && "lg:hidden")}
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

function GroupLabel({ children, collapsed }: { children: React.ReactNode; collapsed?: boolean }) {
  return (
    <div className={cn("px-3 py-1 text-sm tracking-widest", collapsed && "lg:hidden")} style={{ color: "var(--color-dim)" }}>
      ── {children} ──
    </div>
  );
}

export function Sidebar() {
  const router = useRouter();
  const { tasks, characterSheet, openCreateForm, openEditForm, justCompleted, updateTask, togglePin } = useTasks();
  const { notify } = useNotifications();
  const { collapsed, setCollapsed, mobileOpen, setMobileOpen } = useSidebar();
  const [showQuit, setShowQuit] = useState(false);
  const [pinnedNotes, setPinnedNotes] = useState<NotePreview[]>([]);
  const { setOpen: setCommandPaletteOpen } = useCommandPalette();

  const fetchPinnedNotes = useCallback(async () => {
    const result = await listNotesAction({ skip: 0, take: 100 });
    if (result.success) {
      setPinnedNotes(result.data!.notes.filter((n) => n.pinned));
    } else {
      notify(result.error?.message ?? "Failed to load pinned notes.", "error");
    }
  }, [notify]);

  useEffect(() => {
    fetchPinnedNotes();
  }, [fetchPinnedNotes]);
  const sheet = characterSheet;
  const streakDays = useMemo(() => {
    const s = calculateStreak(tasks);

    tasks.forEach(t => {
      const at = completedAt(t);
      const local = at ? formatLocalDate(at) : null;
    });
    return s;
  }, [tasks]);
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
  const pathname = usePathname();

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
          "fixed inset-y-0 left-0 z-40 flex h-full shrink-0 flex-col overflow-y-auto border-r-2 border-border transition-transform duration-200 lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "w-64 lg:w-14" : "w-64 lg:w-52"
        )}
        style={{ backgroundColor: "var(--color-bg-panel-alt)", overflowX: "visible" }}
      >
        <div className="flex items-center justify-between px-4 py-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
          <div>
            <div style={{ fontFamily: "var(--font-press-start), monospace", fontSize: "12px", color: "var(--color-primary-gold)" }}>
              ⚔<span className={cn(collapsed && "lg:hidden")}> ATLAS</span>
            </div>
            <div className={cn("mt-1 text-sm", collapsed && "lg:hidden")} style={{ color: "var(--color-text-muted)" }}>
              Your Second Brain
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden shrink-0 items-center justify-center p-1 lg:flex"
            style={{ color: "var(--color-text-muted)" }}
          >
            <PanelLeftIcon size={14} />
          </button>
        </div>

        {/* Compact XP strip — docs/03-design.md §10 ("compact" XpBar variant) */}
        <div className={cn("flex flex-col gap-1.5 px-4 py-3", collapsed && "lg:hidden")} style={{ borderBottom: "1px solid var(--color-border)" }}>
          <XpBar level={sheet.globalLevel} xpIntoLevel={sheet.xpIntoLevel} xpForNextLevel={sheet.xpForNextLevel} compact />
          <div className="flex items-center gap-3 text-sm">
            <span
              title={todayCompletedCount === 0 ? "You need to complete a task today to fire the streak!" : "Streak active!"}
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
                    style={{ backgroundColor: i < streakDays ? "var(--color-streak-flame)" : "var(--color-border)" }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={cn("px-3 py-2", collapsed && "lg:hidden")} style={{ borderBottom: "1px solid var(--color-border)" }}>
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
          <GroupLabel collapsed={collapsed}>CORE</GroupLabel>
          {NAV_CORE.map((item) => (
            <NavLink key={item.href} {...item} collapsed={collapsed} />
          ))}
          <Link
            href={NAV_TASKS.href}
            title={collapsed ? NAV_TASKS.label : undefined}
            className="flex w-full items-center gap-2 px-3 py-1 text-sm transition-all"
            style={{
              backgroundColor: tasksActive ? "var(--color-bg-panel)" : "transparent",
              color: tasksActive ? "var(--color-primary-gold)" : "var(--color-text-muted)",
              borderLeft: tasksActive ? "2px solid var(--color-primary-gold)" : "2px solid transparent",
            }}
          >
            <NAV_TASKS.icon size={12} />
            <span className={cn("flex-1", collapsed && "lg:hidden")}>{NAV_TASKS.label}</span>
          </Link>

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

        <div className={cn(collapsed && "lg:hidden")}>
          <Companion
            level={sheet.globalLevel}
            todayCompleted={todayCompletedCount}
            justCompleted={justCompleted}
            pinnedTasks={pinnedTasks}
            pinnedNotes={pinnedNotes}
            onOpenTask={(task) => openEditForm(task)}
            onOpenNote={(noteId) => router.push(`/notes?edit=${noteId}`)}
            onUnpinTask={(taskId) => togglePin(taskId, false)}
            onUnpinNote={(noteId) => updateNoteAction({ noteId, pinned: false })}
            onRefreshNotes={fetchPinnedNotes}
          />
        </div>
        <div className="p-3">
          <button
            type="button"
            onClick={openCreateForm}
            title={collapsed ? "New Quest" : undefined}
            className="pixel-button flex w-full items-center justify-center gap-1.5 border-2 border-primary bg-primary px-3 py-1.5 text-sm text-primary-foreground"
          >
            <Plus size={12} /> <span className={cn(collapsed && "lg:hidden")}>New Quest</span>
          </button>
          <button
            type="button"
            onClick={() => setShowQuit(true)}
            title={collapsed ? "Save & Quit" : undefined}
            className="pixel-button mt-2 flex w-full items-center justify-center gap-1.5 border-2 border-border bg-transparent px-3 py-1.5 text-sm transition-colors"
            style={{ color: "var(--color-text-muted)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--color-text)";
              e.currentTarget.style.borderColor = "var(--color-primary-gold)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--color-text-muted)";
              e.currentTarget.style.borderColor = "var(--color-border)";
            }}
          >
            <Moon size={12} /> <span className={cn(collapsed && "lg:hidden")}>Save &amp; Quit</span>
          </button>
        </div>
        {showQuit && <SaveAndQuitOverlay onClose={() => setShowQuit(false)} />}
      </aside>
    </>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: fails right now — `Sidebar.tsx` imports `useSidebar` from `@/components/providers/SidebarProvider`, which isn't wired into any provider tree yet, but that's a runtime concern, not a type error. Expected: no new type errors. (If there are, fix them before proceeding — most likely cause is a typo in one of the `cn(...)` calls above.)

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat: make Sidebar collapsible on desktop and a drawer on mobile"
```

---

### Task 5: Wire `SidebarProvider` + `MobileTopBar` into the dashboard layout

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx:1-19` (imports) and `:139-148` (JSX)

**Interfaces:**
- Consumes: `SidebarProvider` (Task 2), `MobileTopBar` (Task 3), `Sidebar` (Task 4, already imported).

- [ ] **Step 1: Add imports**

In `src/app/(dashboard)/layout.tsx`, add these two imports alongside the existing `Sidebar`/`DefaultViewRedirect`/`CommandPalette` imports (after line 5):

```tsx
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileTopBar } from "@/components/layout/MobileTopBar";
import { DefaultViewRedirect } from "@/components/layout/DefaultViewRedirect";
import { CommandPalette } from "@/components/layout/CommandPalette";
```

And alongside the other provider imports (after the `CommandPaletteProvider` import):

```tsx
import { CommandPaletteProvider } from "@/components/providers/CommandPaletteProvider";
import { SidebarProvider } from "@/components/providers/SidebarProvider";
```

- [ ] **Step 2: Wrap the shell in `SidebarProvider` and add `MobileTopBar`**

Replace:

```tsx
              <CommandPaletteProvider>
                <div className="flex h-full flex-1 overflow-hidden">
                  <Sidebar />
                  <div className="flex-1 overflow-y-auto">{children}</div>
                </div>
                <TaskFormSheet />
                <ProjectFormSheet />
                <SprintFormSheet />
                <CommandPalette />
              </CommandPaletteProvider>
```

with:

```tsx
              <CommandPaletteProvider>
                <SidebarProvider>
                  <div className="flex h-full flex-1 overflow-hidden">
                    <Sidebar />
                    <div className="flex flex-1 flex-col overflow-hidden">
                      <MobileTopBar />
                      <div className="flex-1 overflow-y-auto">{children}</div>
                    </div>
                  </div>
                </SidebarProvider>
                <TaskFormSheet />
                <ProjectFormSheet />
                <SprintFormSheet />
                <CommandPalette />
              </CommandPaletteProvider>
```

(The outer row stays a plain `flex` — no `lg:flex-row` needed. `Sidebar`'s `<aside>` is `fixed` and out of flow below `lg`, so it takes zero flex space on mobile; at `lg`+ it becomes `static` and participates in the row normally.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: PASS, no errors.

- [ ] **Step 4: Manual verification (dev server)**

Run: `npm run dev`, open the app, log in, and check in the browser at these widths (use devtools responsive mode):

- **375px / 414px:** No sidebar visible by default. A top bar with a hamburger + "⚔ ATLAS" shows. Clicking the hamburger slides the sidebar in from the left over a dark backdrop, with full content (XP strip, search, nav, companion, buttons) visible. Clicking the backdrop, pressing `Escape`, or clicking any nav link closes the drawer and (for nav links) navigates.
- **1024px+:** No top bar/hamburger (`lg:hidden` kicks in). Sidebar is static at `w-52` with a collapse button (top-right of the sidebar header). Clicking it shrinks the sidebar to `w-14` — icons only, no labels/XP-strip/search/companion, tooltips on hover via `title`. Reloading the page keeps the collapsed state (persisted via `localStorage`).
- **768px (between):** Same drawer behavior as mobile (below `lg`).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/layout.tsx"
git commit -m "feat: wire SidebarProvider and MobileTopBar into dashboard layout"
```

---

### Task 6: Fix `CharacterContent.tsx` mobile overflow

**Files:**
- Modify: `src/components/gamification/CharacterContent.tsx:61` and `:153`

**Interfaces:** none (isolated styling fix, no signature changes).

- [ ] **Step 1: Make the hero row wrap instead of overflowing**

Replace (line 61):

```tsx
          <div className="flex gap-4 items-start">
```

with:

```tsx
          <div className="flex flex-wrap gap-4 items-start">
```

- [ ] **Step 2: Make the attribute grid responsive**

Replace (line 153):

```tsx
              <div className="grid grid-cols-6 gap-3">
```

with:

```tsx
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: PASS.

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, open `/character` at 375px width. Expected: the avatar/name block/attribute-tiles wrap onto separate rows instead of overflowing horizontally; the 6 attribute tiles show as a 3x2 grid at that width and 1x6 (or 6-wide) above `sm` (640px).

- [ ] **Step 5: Commit**

```bash
git add src/components/gamification/CharacterContent.tsx
git commit -m "fix: wrap character hero row and shrink attribute grid on mobile"
```

---

### Task 7: Fix tasks page tab strip on narrow screens

**Files:**
- Modify: `src/app/(dashboard)/tasks/page.tsx:60-63`

**Interfaces:** none (isolated styling fix).

- [ ] **Step 1: Make the tab strip horizontally scrollable**

Replace:

```tsx
      <div
        className="flex items-center gap-0 px-2 pt-2"
        style={{ borderBottom: "2px solid var(--color-border)", backgroundColor: "var(--color-bg-panel-alt)" }}
      >
```

with:

```tsx
      <div
        className="flex items-center gap-0 overflow-x-auto px-2 pt-2"
        style={{ borderBottom: "2px solid var(--color-border)", backgroundColor: "var(--color-bg-panel-alt)" }}
      >
```

(Tab buttons already have `whitespace-nowrap` — see `page.tsx:70` — so no change needed there.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: PASS.

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, open `/tasks` at 375px width. Expected: the 6 tabs (KANBAN/LIST/CALENDAR/TIMELINE/PROJECTS/ARCHIVE) no longer clip — the strip scrolls horizontally by swipe/drag instead.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/tasks/page.tsx"
git commit -m "fix: make tasks tab strip horizontally scrollable on narrow screens"
```

---

### Task 8: Full build check

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: PASS, including the 4 new tests from Task 1.

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: PASS, no type or lint errors across the whole project.

- [ ] **Step 3: Final manual pass**

Repeat the resize checks from Task 5 Step 4 and Task 6/7 Step 4 once more end-to-end (nothing to commit — this is a confirmation pass before calling the feature done).
