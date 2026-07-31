# Save & Quit — Gamified Logout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Save & Quit" logout flow — a sidebar trigger that opens a save-game-style recap overlay with today's stats and a Companion farewell, then signs out.

**Architecture:** A new client component `SaveAndQuitOverlay` renders a full-screen pixel overlay (mirroring `RecapCutscene.tsx`) that computes today's stats from `useTasks()` using existing gamification lib functions, shows a farewell line from a new pure helper `getFarewell`, and calls `signOut()` from `next-auth/react` after a short "saving" flicker. The sidebar bottom gains a bordered Moon-button trigger with local `useState` to open the overlay.

**Tech Stack:** Next.js 16, React 19, NextAuth v5 beta (`next-auth/react`), Tailwind CSS v4, `lucide-react`, Vitest.

## Global Constraints

- No new dependencies.
- Reuse existing gamification lib functions (`calcTaskXP`, `isTaskOnTime`, `calculateStreak`, `computeCharacterSheet`, `completedAt`, `formatLocalDate`, `getFarewell`) — never duplicate their logic.
- Style with the pixel/dialogue-box aesthetic: `var(--color-*)` CSS vars, `pixel-button` class, `font-display` (Press Start), scanline overlay pattern from `RecapCutscene.tsx`.
- No modal dialog components (`Dialog`, `AlertDialog`); the overlay is a custom full-screen fixed div like `RecapCutscene`.
- `signOut` comes from `next-auth/react` (client-side), not a server action.
- Do NOT modify auth config, providers, or gamification test behavior for existing functions.

---

### Task 1: Add `getFarewell` helper to gamification lib

**Files:**
- Modify: `src/lib/gamification.ts` (add helper near `getCompanionMood`, after line 169)
- Test: `src/lib/gamification.test.ts` (add a new `describe` block at the end of the file)

**Interfaces:**
- Consumes: `CompanionMood` type (already exported from `src/lib/gamification.ts:162`).
- Produces: `export function getFarewell(doneCount: number, streakDays: number): Farewell` where `export interface Farewell { line: string; mood: CompanionMood }`. Later tasks use the returned `line` (text) and `mood` (to pick the companion's color var).

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/gamification.test.ts`:

```ts
describe("getFarewell — save & quit", () => {
  it("stays neutral when nothing was completed today", () => {
    expect(getFarewell(0, 0)).toEqual({
      line: "The realm will keep. See you tomorrow.",
      mood: "sad",
    });
  });

  it("celebrates a strong streak when quests were done today", () => {
    expect(getFarewell(3, 7)).toEqual({
      line: "Legendary work, hero. The flame endures.",
      mood: "happy",
    });
  });

  it("acknowledges a growing streak", () => {
    expect(getFarewell(2, 3)).toEqual({
      line: "Nice quests today. The fire grows.",
      mood: "idle",
    });
  });

  it("cheers any completed quest even with no streak", () => {
    expect(getFarewell(1, 0)).toEqual({
      line: "Every quest counts. Good session.",
      mood: "idle",
    });
  });
});
```

Also add `getFarewell` to the import list at the top of `src/lib/gamification.test.ts` (the existing `import { ... } from "./gamification"` block, lines 2-12).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test`
Expected: FAIL — `getFarewell is not a function`.

- [ ] **Step 3: Write the minimal implementation**

In `src/lib/gamification.ts`, right after the `getCompanionMood` function (line 169):

```ts
/** Save & Quit farewell — docs/superpowers/specs/2026-07-31-save-and-quit-logout-design.md */
export interface Farewell {
  line: string;
  mood: CompanionMood;
}

export function getFarewell(doneCount: number, streakDays: number): Farewell {
  if (doneCount === 0) {
    return { line: "The realm will keep. See you tomorrow.", mood: "sad" };
  }
  if (streakDays >= 7) {
    return { line: "Legendary work, hero. The flame endures.", mood: "happy" };
  }
  if (streakDays >= 3) {
    return { line: "Nice quests today. The fire grows.", mood: "idle" };
  }
  return { line: "Every quest counts. Good session.", mood: "idle" };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test`
Expected: PASS — all suites, including the new `getFarewell` describe block.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gamification.ts src/lib/gamification.test.ts
git commit -m "feat: add getFarewell helper for save & quit overlay"
```

---

### Task 2: Create `SaveAndQuitOverlay` component

**Files:**
- Create: `src/components/gamification/SaveAndQuitOverlay.tsx`

**Interfaces:**
- Consumes: `useTasks()` from `@/components/providers/TasksProvider` (returns `{ tasks, bonusXp, bonusCoins }`); `getFarewell`, `calcTaskXP`, `isTaskOnTime`, `calculateStreak`, `computeCharacterSheet`, `completedAt`, `formatLocalDate`, `CompanionMood` from `@/lib/gamification`; `signOut` from `next-auth/react`.
- Produces: `export function SaveAndQuitOverlay({ onClose }: { onClose: () => void })`. Task 3 renders it and passes `onClose`.

- [ ] **Step 1: Create the component file**

Create `src/components/gamification/SaveAndQuitOverlay.tsx` with the full content below.

```tsx
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
  const { tasks, bonusXp, bonusCoins } = useTasks();
  const [saving, setSaving] = useState(false);
  const quitRef = useRef<HTMLButtonElement>(null);
  const today = useMemo(() => todayStr(), []);

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
  const totalCoins = useMemo(() => computeCharacterSheet(tasks, bonusXp, bonusCoins).totalCoins, [tasks, bonusXp, bonusCoins]);

  const farewell = getFarewell(todayCompletedCount, streakDays);
  const colorVar = MOOD_COLOR_VAR[farewell.mood];

  useEffect(() => {
    quitRef.current?.focus();
  }, []);

  const handleQuit = useCallback(() => {
    if (saving) return;
    setSaving(true);
    window.setTimeout(() => signOut(), 600);
  }, [saving]);

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
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (the `.worktrees/` LSP noise is a separate git worktree, not this repo's build).

- [ ] **Step 3: Commit**

```bash
git add src/components/gamification/SaveAndQuitOverlay.tsx
git commit -m "feat: add save & quit recap overlay component"
```

---

### Task 3: Add the sidebar trigger and render the overlay

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

**Interfaces:**
- Consumes: `SaveAndQuitOverlay` from `@/components/gamification/SaveAndQuitOverlay` (prop `onClose: () => void`).
- Produces: a `🛏 Save & Quit` button at the sidebar bottom (below New Quest) that opens the overlay; the overlay unmounts on cancel/Esc.

- [ ] **Step 1: Update imports and add state**

In `src/components/layout/Sidebar.tsx`:

1. Change `import { useMemo } from "react";` (line 3) to `import { useMemo, useState } from "react";`.
2. Change the lucide import (line 6) from `import { Plus, Search } from "lucide-react";` to `import { Moon, Plus, Search } from "lucide-react";`.
3. Add `import { SaveAndQuitOverlay } from "@/components/gamification/SaveAndQuitOverlay";` after the `Companion` import (line 7).
4. Inside `export function Sidebar()`, add at the top of the body (after line 78 `const { tasks, ... } = useTasks();`):

```tsx
const [showQuit, setShowQuit] = useState(false);
```

- [ ] **Step 2: Add the trigger button and render the overlay**

In the sidebar bottom block (currently lines 216-224, the `p-3` div holding the New Quest button), add the Save & Quit trigger below the New Quest button:

```tsx
      <div className="p-3">
        <button
          type="button"
          onClick={openCreateForm}
          className="pixel-button flex w-full items-center justify-center gap-1.5 border-2 border-primary bg-primary px-3 py-1.5 text-sm text-primary-foreground"
        >
          <Plus size={12} /> New Quest
        </button>
        <button
          type="button"
          onClick={() => setShowQuit(true)}
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
          <Moon size={12} /> Save &amp; Quit
        </button>
      </div>
```

Then, just before the closing `</aside>` tag (after the `p-3` div), render the overlay:

```tsx
      {showQuit && <SaveAndQuitOverlay onClose={() => setShowQuit(false)} />}
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Run: `npm run dev`
Verify:
1. Sidebar bottom shows `🛏 Save & Quit` under `+ New Quest`.
2. Clicking it opens the full-screen SAVE & QUIT overlay with correct today stats (quests done, XP earned, streak, coins) and a farewell line matching today's performance.
3. `Zzz QUIT` shows "SAVING PROGRESS..." then redirects to `/auth` (signed out).
4. `◄ CANCEL` and `Esc` close the overlay without signing out; `Enter` quits.
5. `+ New Quest` still opens the form sheet.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat: add save & quit trigger to sidebar"
```

---

### Task 4: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run all checks**

Run: `npm run test && npm run lint && npx tsc --noEmit`
Expected: all pass.

- [ ] **Step 2: Final manual smoke check**

Run: `npm run dev`, log in, complete a task, open Save & Quit, confirm stats reflect the task and the farewell is celebratory; quit logs out; login again works.
