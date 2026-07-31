# HUD Navbar & Sidebar Redesign

**Date:** 2026-07-31
**Status:** Approved
**Companion to:** `docs/03-design.md`, `docs/02-architecture.md`

## Problem

The dashboard sidebar (`src/components/layout/Sidebar.tsx`) is a fixed 208px column that holds navigation **plus** a tall gamification strip (compact XpBar, streak/coins row, and the next-streak-milestone segmented progress with border separators — `Sidebar.tsx:124-156`) **plus** the full-size Companion sprite at the bottom (~120px, `Companion.tsx`). The combined height pushes navigation links below the fold, so CORE / SMART VIEWS / MANAGE links require scrolling to reach.

## Goal

Move the gamification readout out of the sidebar into a persistent HUD navbar over the content area. The sidebar becomes a pure navigation column: compact companion at top, search, nav groups, "New Quest" as a nav item, and logout at the bottom.

## Layout Structure

New structure in `src/app/(dashboard)/layout.tsx`:

```
┌─ Sidebar (full height) ─┬────────────────────────────────┐
│  ⚔ ATLAS   👾 PIP        │ HUD Navbar: Lv.7 █████░░ 28%   │
│  [Search Ctrl+K]         │ 🔥 5d ▮▮▮▮▮░ 2d   🪙 1,240     │
│  ── CORE ──              │            [ user ⚙ ]          │
│  Command Center          ├────────────────────────────────┤
│  Tasks                   │                                │
│  ── SMART VIEWS ──       │            content             │
│  Today · Inbox · ...     │                                │
│  ── MANAGE ──            │                                │
│  Projects · ...          │                                │
│  + New Quest             │                                │
│  [Logout]                │                                │
└──────────────────────────┴────────────────────────────────┘
```

- The sidebar keeps full height on the left; the HUD navbar spans only the content area on the right.
- The content container becomes `flex-1 flex-col` — navbar on top, scrollable page below.

## Components

### 1. `components/layout/HudNavbar.tsx` (new, client)

Owns the gamification state currently computed inside `Sidebar.tsx`:
- `computeCharacterSheet(tasks, bonusXp, bonusCoins)` → level, `xpIntoLevel`, `xpForNextLevel`, `totalCoins`
- `calculateStreak(tasks)` → streak days
- `getNextStreakMilestone(streakDays)` → milestone label / days-left / target

Receives `user: { name?: string; email?: string }` from the server layout (from `session.user`).

Layout (left → right):
- **XP readout:** `XpBar` with a new `navbar` density (8 blocks, inline level label, no XP-number row).
- **Streak chip:** `🔥 {streakDays}d` — flame renders grayscale/dim when today's streak hasn't fired yet (same logic as the current `todayCompletedCount` check in `Sidebar.tsx`).
- **Milestone strip:** the slim segmented bar moved from `Sidebar.tsx:139-155` — "Next: {milestone.label}" · `{milestone.daysLeft}d` + segmented bar (segments = milestone.target, filled = streakDays).
- **Coins chip:** `🪙 {totalCoins}`.
- **User block:** a small avatar showing the session user's initial, with a settings link and a logout control.

Styling follows the pixel/dialogue-box aesthetic (borders, `var(--color-border)`, CSS vars) consistent with the existing layout. Bottom border separates navbar from content.

### 2. `components/layout/Sidebar.tsx` (modified)

- **Remove** the entire compact XP strip block (`Sidebar.tsx:124-156`): XpBar, streak/coins row, milestone segment. All gamification computation and imports for it move to `HudNavbar`.
- **Companion** moves to the top, directly under the logo header, rendered in a new compact form (see below). It still receives `level`, `todayCompleted`, `justCompleted` from `useTasks`.
- **Search pill** stays where it is (below companion).
- **New Quest** becomes a nav item at the bottom of the MANAGE group (uses `openCreateForm` from `useTasks`, styled like `NavLink` but acting as a button).
- **Logout button** replaces the New Quest button at the very bottom (`Sidebar.tsx:216-224`), styled as a pixel button with a `LogOut` icon.

### 3. `components/gamification/Companion.tsx` (modified)

Add a `compact?: boolean` prop. When `compact`:
- Renders only the PIP head/sprite block (the existing 40×34 sprite) at reduced size, with the hover tooltip retained.
- Drops the feet blocks and the nameplate/label section below the sprite (~70px saved).
- Mood colors/animations/tooltip text are unchanged.

### 4. `components/gamification/XpBar.tsx` (modified)

Add a `navbar` density alongside `compact`:
- `blocks = 8` for the navbar variant.
- Inline level label; no `xpIntoLevel / xpForNextLevel XP` + `%` text row (that row only shows in the default/non-compact forms).
- The navbar XP block renders as a single inline row: `Lv.{level}` · 8-block PixBar · `{pct}%` — the full XP numbers are only on the dashboard hero panel.

### 5. `src/app/(dashboard)/layout.tsx` (modified)

- Render `<HudNavbar user={...} />` above `<div className="flex-1 overflow-y-auto">{children}</div>`.
- Pass `session.user` (name/email) into `HudNavbar`.
- Change the content wrapper to a vertical flex column: `<div className="flex flex-1 flex-col overflow-hidden">` wrapping navbar + scrollable page.

## Auth

- Logout uses `signOut` from `next-auth/react` in the client Sidebar (NextAuth v5 beta supports client-side `signOut`). No server-action changes needed.
- The dashboard layout already fetches `session` and redirects unauthenticated users — unchanged.

## Files Touched

| File | Change |
|------|--------|
| `src/components/layout/HudNavbar.tsx` | **new** — XP + streak + milestone + coins + user block |
| `src/components/layout/Sidebar.tsx` | remove XP strip; companion top; New Quest nav item; logout bottom |
| `src/components/gamification/Companion.tsx` | add `compact` prop |
| `src/components/gamification/XpBar.tsx` | add `navbar` density (8 blocks, inline) |
| `src/app/(dashboard)/layout.tsx` | render `HudNavbar`, pass user, flex-col content |

## Out of Scope

- The dashboard hero panel (`dashboard/page.tsx`) keeps its richer XP/streak/coins display — the navbar is the persistent mini-HUD, not a replacement for the hero.
- No responsive/breakpoint behavior for the navbar beyond natural flex-wrap. Desktop-first, consistent with the existing app.
- No changes to the CommandPalette, providers, or task/sprint/project systems.

## Testing

- Existing tests (`vitest`) must continue passing: `src/lib/gamification.test.ts`, `statistics.test.ts`, `tasks-reducer.test.ts`, `task-filters.test.ts`, `tasks-reducer` — none of the gamification logic is changing, only where it renders.
- Manual check: `npm run dev` → sidebar shows companion at top, no XP strip; navbar shows XP/streak/milestone/coins/user; nav links all reachable without scrolling; "New Quest" opens the form sheet; logout signs out.
