# Server-Computed Character Sheet & Live-Feedback Mechanism (Phase 2)

**Status:** Approved, not yet implemented
**Companion to:** `docs/01-product.md`, `docs/05-backlog.md` §8, `docs/superpowers/specs/2026-08-02-server-computed-stats-achievements-design.md` (Phase 1 — §2/§6 explain why this was deferred)

## 1. Motivation

Phase 1 moved Statistics and Achievements to server-computed data. Character Sheet (XP/level/coins) was deliberately deferred: it's read in 6 places, one of which — the Sidebar's XP bar — updates **instantly** on task completion today via a client-side optimistic recompute over `allTimeTasks`. Moving to a once-per-page-load server computation without also fixing the write side would make that XP bar go stale until the next reload.

This phase closes that gap by moving the write-side computation server-side too, using the same mechanism Phase 1 established for the read side: the *same, unchanged* pure functions (`computeCharacterSheet`, `computeUnlockedAchievements`), just invoked server-side instead of scanning a client array.

## 2. The two-part split (confirmed)

Task completion currently produces two distinct pieces of feedback that need different treatment:

1. **The completed task's own "+XP" toast** — `calcTaskXP(priority, storyPoint, onTime)`, a pure per-task formula with zero dependency on historical/global data. **Unchanged by this phase** — it was never the buggy part and needs no server round-trip.
2. **The global running character sheet** (total XP, level, coins) and **level-up/achievement-unlock detection** (comparing old-vs-new global totals) — this is the piece that depends on full history and is where the original double-bookkeeping bug (docs/05-backlog.md §8 finding #1) came from. This phase moves it server-side.

Current-streak-milestone detection (`checkAndEmitStreakMilestone`) is **also unchanged** — it already correctly operates on the recent-window `tasks` (not `allTimeTasks`), since current streak was never a full-history concern.

## 3. Architecture

New shared helper, `src/lib/character-sheet-data.ts`:

```ts
export interface CharacterSheetData {
  characterSheet: CharacterSheet; // unchanged type, from gamification.ts
  unlockedAchievements: Record<string, { unlocked: boolean; unlockedAt: string | null }>;
}

export async function getCharacterSheetData(ownerId: string): Promise<CharacterSheetData>
```

Self-contained: queries all non-deleted done tasks + active projects + all sprints + the owner's `bonusXp`/`bonusCoins` fresh from the DB (mirrors the query shape in `achievements-data.ts`), then calls the unchanged `computeCharacterSheet`/`computeUnlockedAchievements`. Takes `ownerId` directly (not a session) — it's an internal utility called only from already-authenticated contexts, unlike `getStatisticsPageData`/`getAchievementsPageData` which are page-level entry points and do their own auth.

Called from two places:
1. **`layout.tsx`** — once per page load, computing the *initial* value passed into `TasksProvider` as `initialCharacterSheet`/`initialUnlockedAchievements` props. This runs alongside (not replacing) the existing `allDoneTasks` query there, which stays — it's still needed for `TasksProvider`'s `allTimeTasks`, narrowed to its one remaining consumer (`TaskFormSheet`'s relation-trashed check). Two similar-shaped queries on one page load is an accepted, deliberate tradeoff — they serve genuinely different purposes now (one needs full `Task` client objects, the other just aggregate numbers) and at this app's personal-account scale the extra query is free.
2. **`updateTask`, `createTask`, `claimDailyQuestAction`** — after their own DB write, called again to return the *fresh* post-mutation value inline in the response, alongside whatever each action already returns.

## 4. Data flow (task completion — the main case)

```
Client: updateTask(id, values) called (status → done)
  → per-task "+XP" toast fires immediately (calcTaskXP, unchanged, no wait)
  → apiUpdateTask(id, input) — server writes the task
      → server calls getCharacterSheetData(ownerId)
      → returns { data: task, characterSheet, unlockedAchievements }
  → client already holds the PREVIOUS characterSheet/unlockedAchievements in
    TasksProvider state — that's "old", no extra fetch needed
  → checkAndEmitLevelUp(old.globalXP, new.globalXP)         [unchanged function]
  → checkAndEmitAchievementUnlocks(old, new)                [unchanged function]
  → setCharacterSheet(new); setUnlockedAchievements(new)
```

The same shape applies to `createTask` (covers the edge case of creating a task already marked "done") and `claimDailyQuestAction` (which already changes `bonusXp`/`bonusCoins` server-side — now returns the sheet reflecting that change directly, instead of the client recomputing from its own cached `bonusXp` state).

## 5. State shape change in `TasksProvider`

- New props: `initialCharacterSheet: CharacterSheet`, `initialUnlockedAchievements: Record<string, {unlocked, unlockedAt}>`.
- New state: `characterSheet`, `unlockedAchievements`, replacing the per-consumer `computeCharacterSheet(allTimeTasks, bonusXp, bonusCoins)`/`computeUnlockedAchievements(allTimeTasks, ...)` calls that currently live inside the mutation handlers and are recomputed independently by each of the 6 consumer components.
- The 6 consumers (Sidebar, CharacterContent, RoomDecoration, SaveAndQuitOverlay, `settings/page.tsx`, `dashboard/page.tsx`) drop their own `computeCharacterSheet` calls and read `characterSheet` straight off `useTasks()` context — mirrors how `bonusXp`/`bonusCoins` already work today.
- `bonusXp`/`bonusCoins` state stays in the context too (still read directly by the "Reset All" flow, which zeroes them alongside a reset `characterSheet`).
- `allTimeTasks`/`allDoneTasksBeyondWindow` stays in `TasksProvider`, unchanged, narrowed to `TaskFormSheet`'s relation-trashed-check — its only remaining consumer after this phase.

## 6. Error handling

If `getCharacterSheetData` throws inside a mutation action (`updateTask`/`createTask`/`claimDailyQuestAction`), the action still returns success for the underlying write (the task/bonus change already committed) but omits `characterSheet`/`unlockedAchievements` from the response — the client keeps its last-known sheet rather than failing the whole mutation over a secondary computation. `layout.tsx`'s own call has no such fallback — an uncaught error there is a page-level failure, same as every other query already in that file.

## 7. Testing

Same bar as Phase 1: `npx tsc --noEmit`, `npx vitest run` (104 existing tests must stay green — none of the pure functions change), `npx next build`, and a manual browser check that goes further than Phase 1's did — actually complete a task and confirm (a) the Sidebar XP bar updates instantly, (b) a level-up crossing still fires the level-up toast correctly, (c) an achievement unlock still fires correctly, (d) the Daily Quest claim flow still updates the sheet correctly.

## 8. Explicitly out of scope

- Removing `allTimeTasks`/`allDoneTasksBeyondWindow` entirely — not possible until `TaskFormSheet`'s relation-trashed-check also moves off it, which is a separate, unrelated piece of work not requested for this phase.
- Any change to `calcTaskXP`, `checkAndEmitLevelUp`, `checkAndEmitAchievementUnlocks`, `checkAndEmitStreakMilestone`, or any other pure function in `gamification.ts` — all unchanged, only *where* they're invoked and *what feeds them* changes.
