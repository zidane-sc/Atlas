# Save & Quit — Gamified Logout

**Date:** 2026-07-31
**Status:** Approved
**Companion to:** `docs/03-design.md`, `docs/02-architecture.md`

## Problem

The dashboard has no logout control. The session lives in a NextAuth JWT cookie and users must clear cookies to sign out. A previous sidebar redesign (reverted in `2577394`) introduced a plain pixel `LogOut` button at the sidebar bottom, but it was discarded with the whole redesign.

## Goal

Add an interactive, well-UX'd, gamified logout: a "Save & Quit" trigger in the sidebar that opens a save-game-style recap overlay showing today's session stats and a farewell from the Companion, then signs out. The recap screen *is* the confirmation — one deliberate click on the trigger, one on QUIT.

## Layout / Flow

```
Sidebar bottom                                Overlay (full-screen)
┌──────────────────────┐
│  + New Quest         │   click "🛏 Save & Quit"
│  🛏 Save & Quit ─────┼─────────────────────────────►  ◈ SAVE & QUIT
└──────────────────────┘     "Atlas saves your progress.     ┌────────┐┌────────┐
                              Your quest resumes tomorrow."  │Quests  ││ XP     │
                                   PIP: "Legendary work, hero."│Done 🗡 ││ today ✦│
                                                              ├────────┤├────────┤
                                                              │🔥 5d   ││🪙 1,240│
                                                              └────────┘└────────┘
                                                              [◄ CANCEL]  [Zzz QUIT]
```

## Components

### 1. `src/lib/gamification.ts` (modified)

Add a pure, testable helper:

```ts
getFarewell(doneCount: number, streakDays: number): { line: string; mood: string }
```

- `doneCount > 0` → celebratory line keyed off streak (e.g. `"Legendary work, hero."` at high streak, `"Nice quests today."` at zero/low streak).
- `doneCount === 0` → neutral line (e.g. `"The realm will keep. See you tomorrow."`).
- `mood` selects the Companion sprite mood so the overlay can reuse `Companion`'s mood palette.

### 2. `src/components/gamification/SaveAndQuitOverlay.tsx` (new, client)

Owns the recap + sign-out flow. Reads `useTasks()` directly (`tasks`, `bonusXp`, `bonusCoins`) and computes stats with the same lib functions the Sidebar uses:

- `computeCharacterSheet(tasks, bonusXp, bonusCoins)` → level, `xpIntoLevel`, `xpForNextLevel`, `totalCoins`
- `calculateStreak(tasks)` → streak days
- Today's completed count via `completedAt(t)` + `formatLocalDate` (same logic as `todayCompletedCount` in `Sidebar.tsx`)
- Today's XP gained: sum XP of tasks completed today

Behavior:

- Full-screen fixed overlay, `z-[60]`, near-black bg + scanline overlay (same treatment as `RecapCutscene.tsx`).
- Press-start title `◈ SAVE & QUIT`; sub-line `Atlas saves your progress. Your quest resumes tomorrow.`
- 2×2 bordered stat cards (like the recap): Quests Done · XP Earned · Day Streak · Coins. Streak card dims when today's streak hasn't fired yet.
- Companion farewell line from `getFarewell` below the stats, rendered in the Companion's mood color.
- `◄ CANCEL` (ghost) closes the overlay; `Zzz QUIT` (gold primary) shows a brief ~600ms `Saving progress...` flicker then calls `signOut()` from `next-auth/react` (redirects to `/auth`).
- Keyboard: `Esc` = cancel, `Enter` = quit (same keys as `RecapCutscene`).
- `role="dialog"` + `aria-modal`; focus lands on QUIT when opened.

### 3. `src/components/layout/Sidebar.tsx` (modified)

- Add a `🛏 Save & Quit` trigger button at the bottom, *below* the existing New Quest button.
- Moon icon (fits the sleep/save metaphor), bordered pixel secondary style (`border-border`, transparent bg, muted text) — mirrors the reverted design's logout styling but with a Moon glyph.
- Clicking opens the overlay via local state.

## Auth

- `signOut` comes from `next-auth/react` (NextAuth v5 beta supports client-side `signOut`). No server-action changes.
- The dashboard layout already fetches `session` and redirects unauthenticated users — unchanged.

## Files Touched

| File | Change |
|------|--------|
| `src/lib/gamification.ts` | add `getFarewell(doneCount, streakDays)` pure helper |
| `src/components/gamification/SaveAndQuitOverlay.tsx` | **new** — recap overlay + sign-out flow |
| `src/components/layout/Sidebar.tsx` | add `🛏 Save & Quit` trigger at bottom |

## Out of Scope

- No active-timer behavior changes (a running timer is left as-is on logout).
- No changes to RecapCutscene, providers, or the weekly/monthly recap system.
- No responsive/breakpoint work; desktop-first, consistent with the app.
- No changes to auth/session config.

## Testing

- New `vitest` unit tests for `getFarewell` (done > 0 with/without streak, done === 0).
- Existing tests must continue passing (`npm run test`).
- Manual check: `npm run dev` → click `🛏 Save & Quit` → overlay shows correct today stats + farewell → `Zzz QUIT` signs out to `/auth`; `CANCEL`/`Esc` closes without signing out.
- `npm run lint` clean.
