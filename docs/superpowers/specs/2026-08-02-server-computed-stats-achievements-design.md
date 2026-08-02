# Server-Computed Statistics & Achievements (Phase 1 of BE-computes/FE-consumes migration)

**Status:** Approved, not yet implemented
**Companion to:** `docs/01-product.md`, `docs/05-backlog.md` §8 (finding #16 and the deeper edge-case audit)

## 1. Motivation

Atlas currently loads up to 200 `Task` rows into client state (`TasksProvider`) on every dashboard navigation, and computes every derived value — XP/level (`computeCharacterSheet`), achievements (`computeUnlockedAchievements`/`computeAchievementProgress`), streaks, and statistics (`calcCompletionRate`, `calcAverageTaskDurationDays`, `calcFocusHours`, etc.) — client-side in the browser, from that bulk array.

A related correctness gap (the 200-task cap silently excluding historical data from these calculations, docs/05-backlog.md §8 finding #15) was patched earlier the same day by adding a second unbounded client-side array (`allTimeTasks`) and doing more JS-side array scanning in the browser. That's a workaround, not a fix to the underlying pattern: the browser should not be shipping/scanning raw task rows just to sum them — that's the DB/server's job.

This spec covers **Phase 1** only: moving the Statistics and Achievements pages to server-computed data. Character Sheet (XP/level/coins) is explicitly **out of scope** for this phase — see §6.

## 2. Why Character Sheet is a separate phase

Character Sheet data (`computeCharacterSheet`) is read in 6 places, one of which is the Sidebar — rendered on *every* page, showing the XP bar update **instantly** the moment a task is completed (client-side optimistic recompute). Moving Character Sheet to a once-per-page-load server computation now would make that XP bar go stale until the next full reload, since Next.js layouts don't re-fetch on client-side navigation. Fixing that staleness requires the write-side change (mutation actions returning the fresh computed delta inline) — deliberately deferred to Phase 2, so Phase 1 introduces zero regression risk.

Statistics and Achievements have no equivalent "must update instantly mid-session" requirement — both are reporting/display screens. Confirmed by inspection: neither has any interactive task-navigation behavior, only local UI state (filter toggles, chart hover). Moving them is fully separable.

## 3. Architecture

`app/(dashboard)/statistics/page.tsx` and `app/(dashboard)/achievements/page.tsx` — both currently trivial pass-throughs rendering a client wrapper — become `async` Server Components:

1. Resolve session → owner, same pattern every existing server action already uses (`auth()`, then `db.user.findUnique`/`upsert`).
2. Run one fresh, **unbounded** `db.task.findMany({ where: { ownerId, deletedAt: null } })` — no `take` limit, no nested `statusHistory`/`comments` includes (not needed; `createdAt`/`completedAt` are direct scalar columns as of this session's earlier work). Plus `db.project.findMany`/`db.sprint.findMany` where needed (Achievements needs sprints for `computeAchievementProgress`; Statistics needs projects for the by-project breakdown and top-project).
3. Map to client `Task[]` via the existing `mapDbTaskToClient` (unchanged, already handles missing `statusHistory`/`comments` gracefully).
4. Call the **same, untouched** pure functions already in `gamification.ts`/`statistics.ts` (`calcCompletionRate`, `calcAverageTaskDurationDays`, `calcFocusHours`, `calculateLongestStreak`, `calcEstimatedVsActualStoryPoints`, `buildProductivityProfile`, `buildHeatmapGrid`, `buildRecap`, `buildWeeklyThroughput`, `computeUnlockedAchievements`, `computeAchievementProgress`) to build one plain computed object per page.
5. Pass that object as a single prop down through the existing client wrappers (`StatisticsPage`/`AchievementsPage`, which keep their `dynamic(..., { ssr: false })` lazy-loading — unaffected by this change) into `StatisticsContent`/`AchievementsContent`.

`StatisticsContent`/`AchievementsContent` drop their `useTasks()`/`useProjects()`/`useSprints()` calls **entirely** and become pure rendering components: charts, panels, filter toggles, no data-fetching or computation of their own. All `useMemo`-wrapped computations currently in `StatisticsContent` are deleted — they become plain reads off the incoming prop (no need to memoize data that's already computed once, server-side, per request).

**Side effect (not a goal, but a real consequence):** this fully retires the 200-task cap for these two pages — a dedicated per-page query has no reason to reuse the interactive view's capped 200-row window. `TasksProvider`'s `allTimeTasks`/`allDoneTasksBeyondWindow` mechanism stays in place — still needed by the 6 Character Sheet consumers and `TaskFormSheet`'s relation-trashed-existence check (docs/05-backlog.md §8 finding #5) — it just loses 2 of its current 8 consumers (`StatisticsContent`, `AchievementsContent`).

## 4. Data flow

```
Request → page.tsx (Server Component)
  → auth() + owner resolution
  → db.task.findMany (unbounded) + db.project.findMany [+ db.sprint.findMany for Achievements]
  → mapDbTaskToClient(...)
  → existing pure compute functions (unchanged)
  → plain computed object
  → <StatisticsPage stats={...} /> / <AchievementsPage achievements={...} />
  → client wrapper (unchanged, ssr:false dynamic import)
  → <StatisticsContent stats={...} /> / <AchievementsContent achievements={...} />
  → pure render, local UI state only
```

No client-side recomputation. No raw task rows shipped to the browser for either page — only the computed numbers/objects needed for display.

## 5. Error handling

Matches the existing convention: if the DB query fails or the session is invalid, handle it at the page level the same way `layout.tsx` already does (redirect on missing session; letting a genuine DB error surface as a Next.js error boundary is acceptable here, same as any other Server Component data-fetching failure in this app — there's no existing precedent in this codebase for a custom per-page error UI beyond what Next.js provides by default). No `ActionResult` success/error shape is needed here since this isn't a server action being called from a client mutation — it's a direct render-time fetch.

## 6. Explicitly out of scope (Phase 2)

- Character Sheet (XP/level/coins/skills/class-title) — stays client-computed via `computeCharacterSheet(allTimeTasks, ...)` in all 6 current consumers (Sidebar, CharacterContent, RoomDecoration, SaveAndQuitOverlay, `settings/page.tsx`, `dashboard/page.tsx`).
- The live-feedback mechanism (instant XP/level-up/achievement-unlock toast on task completion) — stays exactly as it is today, computed client-side in `TasksProvider`'s `updateTask`/`claimDailyQuest` handlers.
- Fully removing `allTimeTasks`/`allDoneTasksBeyondWindow` from `TasksProvider` — only possible once Phase 2 also moves Character Sheet server-side.

## 7. Testing

The pure functions being invoked are unchanged and already covered by existing unit tests (`gamification.test.ts`, `statistics.test.ts`). The new surface — page-level data fetching and prop wiring — doesn't warrant new unit tests on its own; verification is a manual pass in the browser confirming both pages render correctly and existing interactive elements (filter toggles, tag pickers) still work, plus the existing `npx vitest run` + `npx tsc --noEmit` + `npx next build` checks this session has used throughout.
