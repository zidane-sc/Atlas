# HUD Navbar & Sidebar Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the gamification HUD (XP bar, streak, milestone, coins, user) out of the sidebar into a new top navbar, and slim the sidebar down to pure navigation with a compact companion, New Quest nav item, and logout button.

**Architecture:** The dashboard layout (`(dashboard)/layout.tsx`) wraps the content area in a flex column: a new client `HudNavbar` on top, the scrollable page below. The sidebar keeps full height on the left and drops its XP strip. All gamification state computation moves from `Sidebar.tsx` into `HudNavbar.tsx`. `Companion` gains a `compact` prop; `XpBar` gains a `navbar` density.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, lucide-react, next-auth v5 beta.

**Spec:** `docs/superpowers/specs/2026-07-31-hud-navbar-redesign-design.md`

## Global Constraints

- Pixel-art "dialogue box" aesthetic: use CSS vars (`var(--color-border)`, `var(--color-bg-panel)`, `var(--color-primary-gold)`, `var(--color-xp-gold)`, `var(--color-coin)`, `var(--color-streak-flame)`, `var(--color-dim)`) — never hardcode hex values.
- No comments in code unless the file already carries a doc-comment convention (e.g. `XpBar.tsx` has a leading doc comment — keep it updated).
- Components that need `useTasks()`/`usePathname()` are client components (`"use client"`).
- No new dependencies. Use existing `lucide-react` icons.
- `npm test` (vitest), `npm run lint`, and `npm run build` must all pass after the final task.
- The existing gamification logic in `src/lib/gamification.ts` is unchanged — this plan only moves where it renders.
- Existing test files: `src/lib/gamification.test.ts`, `src/lib/statistics.test.ts`, `src/lib/tasks-reducer.test.ts`, `src/lib/task-filters.test.ts`. These must continue to pass unchanged.

---

### Task 1: Add `navbar` density to `XpBar`

**Files:**
- Modify: `src/components/gamification/XpBar.tsx`

**Interfaces:**
- Consumes: `PixBar` from `@/components/ui/PixBar` (already imported).
- Produces: `XpBar` accepts `density: "default" | "compact" | "navbar"` (default `"default"`). For `navbar`: `blocks=8`, level label + 8-block PixBar + `{pct}%` all on one inline row, no `xpIntoLevel / xpForNextLevel XP` text row.

- [ ] **Step 1: Read the current component**

Read `src/components/gamification/XpBar.tsx` (40 lines). Note the existing `compact` prop — we're adding a third `navbar` density without breaking `compact` callers.

- [ ] **Step 2: Add the `navbar` density**

Replace the props and render logic so the component reads:

```tsx
import { PixBar } from "@/components/ui/PixBar";

/** XP progress meter — docs/03-design.md §10 (Dashboard) uses 24 blocks, the Sidebar's compact strip uses 10, the HUD navbar uses 8. */
export function XpBar({
  level,
  xpIntoLevel,
  xpForNextLevel,
  density = "default",
}: {
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  density?: "default" | "compact" | "navbar";
}) {
  const pct = Math.round((xpIntoLevel / xpForNextLevel) * 100);

  if (density === "navbar") {
    return (
      <div className="flex items-center gap-2">
        <span
          className="font-display"
          style={{ color: "var(--color-xp-gold)", fontSize: "10px" }}
        >
          Lv.{level}
        </span>
        <PixBar
          value={xpIntoLevel}
          max={xpForNextLevel}
          colorVar="--color-xp-gold"
          blocks={8}
          showLabel={false}
        />
        <span className="text-sm shrink-0" style={{ color: "var(--color-text-muted)" }}>
          {pct}%
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span
        className="font-display"
        style={{ color: "var(--color-xp-gold)", fontSize: density === "compact" ? "10px" : "14px" }}
      >
        {level}
      </span>
      <div className="flex-1">
        <PixBar
          value={xpIntoLevel}
          max={xpForNextLevel}
          colorVar="--color-xp-gold"
          blocks={density === "compact" ? 10 : 20}
          showLabel={false}
        />
        <div className="mt-0.5 flex justify-between text-sm" style={{ color: "var(--color-text-muted)" }}>
          <span style={{ color: "var(--color-xp-gold)" }}>{xpIntoLevel} / {xpForNextLevel} XP</span>
          <span>{pct}%</span>
        </div>
      </div>
    </div>
  );
}
```

This replaces the old `compact?: boolean` prop with a `density` union. The next task updates the only caller (Sidebar), so the breaking change is contained within this plan.

- [ ] **Step 3: Update any existing callers to the new prop**

`grep -rn "compact" src/components/gamification/XpBar.tsx` and `grep -rn "XpBar" src/` — the only caller today is `Sidebar.tsx:126` which passes `compact`. That call site is removed entirely in Task 4, so **do not** migrate it here; leave Sidebar temporarily broken until Task 4 (tasks are implemented in order). Confirm no other caller exists.

- [ ] **Step 4: Run lint and tests**

Run: `npm run lint && npm test`
Expected: lint passes (the Sidebar XpBar call is a type error only under `tsc`, which lint doesn't run — if lint flags `compact`, temporarily keep both props until Task 4 by leaving `compact?: boolean` as a deprecated alias: `density = "default", compact = false` mapping to `density={compact ? "compact" : density}`).

- [ ] **Step 5: Commit**

```bash
git add src/components/gamification/XpBar.tsx
git commit -m "feat: add navbar density to XpBar"
```

---

### Task 2: Add `compact` prop to `Companion`

**Files:**
- Modify: `src/components/gamification/Companion.tsx`

**Interfaces:**
- Consumes: `getCompanionMood`, `CompanionMood` from `@/lib/gamification` (already imported).
- Produces: `Companion` accepts `compact?: boolean`. When `true`, render only the sprite (the animated `div` with the body block) at reduced scale with the hover tooltip, dropping the feet row and the nameplate/label section below the sprite.

- [ ] **Step 1: Read the current component**

Read `src/components/gamification/Companion.tsx`. The sprite block is the `div` with `style={{ animation: MOOD_ANIMATION[mood], ... }}` (lines 133-207), followed by feet (209-213) and the nameplate (216-219).

- [ ] **Step 2: Add the compact branch**

Add a `compact` prop and conditionally render. The sprite width/height are the module constants `W = 40`, `H = 34`. When `compact`, wrap the sprite at `transform: scale(0.8)` with a reduced-size container so it still takes its layout space, and keep the hover tooltip (lines 110-130) unchanged.

Change the signature to:

```tsx
export function Companion({
  level,
  todayCompleted,
  justCompleted = false,
  compact = false,
}: {
  level: number;
  todayCompleted: number;
  justCompleted?: boolean;
  compact?: boolean;
}) {
```

Then replace the bottom section (feet + nameplate) so that when `compact`:

```tsx
      <div className="flex cursor-default flex-col items-center gap-0">
        <div style={{ animation: MOOD_ANIMATION[mood], transformOrigin: "bottom center", display: "inline-block" }}>
          {/* body — keep exactly as-is (lines 134-207) */}
        </div>

        {!compact && (
          <>
            {/* feet — keep as-is (lines 210-213) */}
            <div className="mt-1.5 text-center">
              <div className="font-display text-[7px]" style={{ color: `var(${colorVar})` }}>PIP</div>
              <div className="text-xs" style={{ color: "var(--color-dim)" }}>companion lv.{compLv}</div>
            </div>
          </>
        )}
      </div>
```

Note: the sprite is rendered at natural size (40×34 px) in both modes; `compact` only removes the feet + nameplate. If it looks oversized in the sidebar, wrap the sprite div in `style={{ transform: "scale(0.8)", transformOrigin: "top center", marginBottom: "-6px" }}` inside the compact branch. Keep the tooltip (lines 110-130) rendered in both modes.

- [ ] **Step 3: Run lint and existing tests**

Run: `npm run lint && npm test`
Expected: both pass. (No unit test covers Companion — it's a pure visual component.)

- [ ] **Step 4: Commit**

```bash
git add src/components/gamification/Companion.tsx
git commit -m "feat: add compact prop to Companion"
```

---

### Task 3: Create `HudNavbar` component

**Files:**
- Create: `src/components/layout/HudNavbar.tsx`
- Test: `src/lib/gamification.test.ts` (unmodified — used only to sanity-check signatures)

**Interfaces:**
- Consumes:
  - `useTasks()` from `@/components/providers/TasksProvider` → `{ tasks, bonusXp, bonusCoins }`
  - `computeCharacterSheet(tasks, bonusXp, bonusCoins)` → `CharacterSheet` with `.globalLevel`, `.xpIntoLevel`, `.xpForNextLevel`, `.totalCoins`
  - `calculateStreak(tasks)` → number
  - `getNextStreakMilestone(streakDays)` → `{ label, daysLeft, target } | null`
  - `completedAt(task)`, `formatLocalDate(dateInput)` from `@/lib/gamification`
  - `MOCK_NOW` from `@/lib/mock-data`
  - `XpBar` from `@/components/gamification/XpBar` with `density="navbar"` (Task 1)
  - `usePathname()` from `next/navigation` for active settings link
  - `Settings` icon from `lucide-react`
- Produces: `HudNavbar({ user }: { user: { name?: string | null; email?: string | null } })` — a client component rendering the XP readout, streak chip + milestone strip, coins chip, and user block.

- [ ] **Step 1: Write the component**

Create `src/components/layout/HudNavbar.tsx`:

```tsx
"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import { XpBar } from "@/components/gamification/XpBar";
import { useTasks } from "@/components/providers/TasksProvider";
import { computeCharacterSheet, calculateStreak, getNextStreakMilestone, completedAt, formatLocalDate } from "@/lib/gamification";
import { MOCK_NOW } from "@/lib/mock-data";

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
```

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: passes. (This component is not referenced anywhere yet, so it's just a type/lint check of the file itself.)

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/HudNavbar.tsx
git commit -m "feat: add HUD navbar with XP, streak, coins, user"
```

---

### Task 4: Rework `Sidebar` — remove XP strip, companion top, New Quest nav item, logout bottom

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

**Interfaces:**
- Consumes:
  - `useTasks()` → `{ tasks, openCreateForm, justCompleted, bonusXp, bonusCoins }`
  - `useCommandPalette()` → `{ setOpen }`
  - `Companion` from `@/components/gamification/Companion` with `compact` prop (Task 2)
  - `NAV_CORE`, `NAV_MANAGE`, `NAV_SMART_VIEWS`, `NAV_TASKS`, `NavItemBase` from `@/lib/nav-items` (unchanged)
  - `signOut` from `next-auth/react`
  - `LogOut`, `Plus` icons from `lucide-react`
- Produces: A sidebar with: logo header → compact Companion → search pill → nav (CORE/Tasks/SMART VIEWS/MANAGE) → New Quest nav item → logout button.

- [ ] **Step 1: Read the current sidebar**

Read `src/components/layout/Sidebar.tsx` (227 lines). Note what stays (`NavLink`, `GroupLabel`, nav groups, search pill, logo header) vs. what moves/deletes (XP strip lines 124-156, bottom New Quest button lines 216-224).

- [ ] **Step 2: Remove the gamification imports and XP strip**

Remove imports no longer needed: `XpBar`, `computeCharacterSheet`, `getNextStreakMilestone`, `calculateStreak`, `completedAt`, `formatLocalDate`, `MOCK_NOW`. Keep `useTasks` (still used for `openCreateForm`, `justCompleted`) and `useCommandPalette`.

Delete the XP strip block (lines 124-156) entirely — the `sheet`, `streakDays`, `todayCompletedCount`, `milestone` memo blocks (lines 80-99) move to `HudNavbar` (Task 3) and are deleted here.

- [ ] **Step 3: Move Companion to the top**

Place `<Companion level={sheet.globalLevel} todayCompleted={todayCompletedCount} justCompleted={justCompleted} compact />` directly under the logo header. But `sheet` and `todayCompletedCount` no longer exist in this file. Add minimal local computation back (the Companion still needs these two values):

```tsx
const { tasks, openCreateForm, justCompleted, bonusXp, bonusCoins } = useTasks();
const sheet = useMemo(() => computeCharacterSheet(tasks, bonusXp, bonusCoins), [tasks, bonusXp, bonusCoins]);
const todayCompletedCount = useMemo(() => {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return tasks.filter((t) => {
    if (t.status !== "done") return false;
    const doneAt = completedAt(t);
    return doneAt ? formatLocalDate(doneAt) === todayStr : false;
  }).length;
}, [tasks]);
```

So the sidebar keeps `computeCharacterSheet` and `completedAt`/`formatLocalDate` imports (they are still needed for Companion). Only the streak/milestone computation is fully gone.

Render order after the logo header:

```tsx
<div style={{ borderBottom: "1px solid var(--color-border)" }}>
  <Companion level={sheet.globalLevel} todayCompleted={todayCompletedCount} justCompleted={justCompleted} compact />
</div>
```

- [ ] **Step 4: Add New Quest as a nav item**

Add `NAV_QUEST` as a constant alongside the nav groups, then render it at the bottom of the MANAGE group:

```tsx
const NAV_QUEST: NavItem = { href: "", label: "New Quest", icon: Plus };

// inside the nav, after NAV_MANAGE links:
<button
  type="button"
  onClick={openCreateForm}
  className="flex w-full items-center gap-2 px-3 py-1 text-sm transition-all"
  style={{
    backgroundColor: "transparent",
    color: "var(--color-primary-gold)",
    borderLeft: "2px solid var(--color-primary-gold)",
  }}
>
  <Plus size={12} />
  <span className="flex-1">{NAV_QUEST.label}</span>
</button>
```

Note: `NavItem` requires `href`, so use a literal object `{ href: "", label: "New Quest", icon: Plus }` and render it as a `<button>` (not `NavLink`), since it opens a form sheet rather than navigating.

- [ ] **Step 5: Replace the bottom button with Logout**

Replace the bottom `<button ... onClick={openCreateForm}>` block (lines 216-224) with:

```tsx
<div className="p-3">
  <button
    type="button"
    onClick={() => signOut()}
    className="pixel-button flex w-full items-center justify-center gap-1.5 border-2 border-border bg-transparent px-3 py-1.5 text-sm"
    style={{ color: "var(--color-text-muted)" }}
  >
    <LogOut size={12} /> Logout
  </button>
</div>
```

Add `import { signOut } from "next-auth/react";` and `import { LogOut, Plus } from "lucide-react";`.

- [ ] **Step 6: Run lint, tests, and typecheck**

Run: `npm run lint && npm test && npx tsc --noEmit`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat: slim sidebar to nav-only with compact companion, New Quest item, logout"
```

---

### Task 5: Wire `HudNavbar` into the dashboard layout

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx`

**Interfaces:**
- Consumes: `HudNavbar` from `@/components/layout/HudNavbar` (Task 3), `session` from `@/lib/auth` (already fetched).
- Produces: The content area renders `HudNavbar` on top and the scrollable page below.

- [ ] **Step 1: Import HudNavbar**

Add `import { HudNavbar } from "@/components/layout/HudNavbar";` near the `Sidebar` import.

- [ ] **Step 2: Restructure the content wrapper**

Change the layout content block (currently `Sidebar` + `<div className="flex-1 overflow-y-auto">{children}</div>` inside `<div className="flex h-full flex-1 overflow-hidden">`) to:

```tsx
<div className="flex h-full flex-1 overflow-hidden">
  <Sidebar />
  <div className="flex flex-1 flex-col overflow-hidden">
    <HudNavbar user={session.user} />
    <div className="flex-1 overflow-y-auto">{children}</div>
  </div>
</div>
```

Note: `session.user` may be `null` per the guard at line 28 — but the redirect already returned if it was falsy, so `session.user` is non-null here. Pass `user={session.user}` directly.

- [ ] **Step 3: Run lint, tests, and build**

Run: `npm run lint && npm test && npm run build`
Expected: lint and tests pass; `npm run build` succeeds (this catches any server/client boundary issues with `HudNavbar`/`Sidebar`).

- [ ] **Step 4: Manual verification**

Run `npm run dev`, open the app, and confirm:
1. Sidebar shows companion at top, no XP strip, all nav links reachable without scrolling.
2. Navbar shows XP (`Lv.N` + 8-block bar + %), streak chip, milestone strip, coins, user avatar.
3. "New Quest" opens the task form sheet.
4. Logout signs out and redirects to `/auth`.
5. All other pages render correctly under the navbar.

- [ ] **Step 5: Commit**

```bash
git add src/app/'(dashboard)'/layout.tsx
git commit -m "feat: render HUD navbar above dashboard content"
```

---

## Self-Review Notes

- **Spec coverage:** Every spec section maps to a task — XpBar navbar density (T1), Companion compact (T2), HudNavbar (T3), Sidebar changes (T4), layout wiring + user pass + flex-col (T5). Auth/logout in T4 Step 5. Dashboard hero panel untouched (out of scope). No spec gap.
- **Placeholder scan:** All steps have concrete code. The only judgment call is Companion sprite scale in T2, which is explicitly described both ways.
- **Type consistency:** `density: "default" | "compact" | "navbar"` used identically in T1 and T3; `compact?: boolean` on Companion consistent between T2 and T4; `HudNavbar({ user })` signature consistent between T3 and T5; `signOut` from `next-auth/react` consistent in T4. `NavItem` type requires `href`, handled in T4 Step 4.
