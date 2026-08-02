# Dashboard — Weekly Story Point Comparison Widget

**Date:** 2026-08-02
**Status:** Design Approved
**Purpose:** Close the last EPIC-13 gap in `01-product.md` §9.4 / `05-backlog.md` §6 — "this week: completed vs. estimated vs. actual story points" is computed (`calcEstimatedVsActualStoryPoints`, `src/lib/statistics.ts`) but only surfaced on the Statistics page, not the Dashboard.

---

## 1. Scope

Add a small panel to the Dashboard (`src/app/(dashboard)/dashboard/page.tsx`) showing, for the trailing 7 days ending now:
- Quests completed
- Story points estimated (sum of `storyPoint` on those completed tasks)
- Actual hours logged (sum of `timeSpentSeconds` on those tasks, via Focus Timer)

No schema change, no new server action — same `Task[]` already available via `useTasks()`.

## 2. "This week" definition

Trailing 7 days ending now (`Date.now()`), not calendar Mon–Sun — matches the existing convention in `StatisticsContent.tsx`'s `buildRecap`/`buildWeeklyThroughput` (week-over-week deltas, recap cutscene). A calendar week would be a second, inconsistent definition of "this week" in the same app.

Anchor time mirrors `StatisticsContent`'s guard: `Math.max(Date.now(), latestCompletionTimestamp)`, so demo/seeded data with a completion timestamp slightly ahead of real time still lands in range.

## 3. Filtering

Inline in the Dashboard page component (matching its existing style — `dueToday`/`overdue`/`blocked` are already computed inline there, not via shared helpers):

```ts
const now = useMemo(() => {
  const doneTasks = tasks.filter((t) => completedAt(t) != null);
  const latest = doneTasks.length > 0 ? Math.max(...doneTasks.map((t) => new Date(completedAt(t)!).getTime())) : 0;
  return Math.max(Date.now(), latest);
}, [tasks]);

const doneThisWeek = useMemo(
  () => tasks.filter((t) => {
    const c = completedAt(t);
    if (!c) return false;
    const ts = new Date(c).getTime();
    return ts >= now - 7 * 86_400_000 && ts <= now;
  }),
  [tasks, now]
);

const weeklyStoryPoints = useMemo(() => calcEstimatedVsActualStoryPoints(doneThisWeek), [doneThisWeek]);
```

`doneThisWeek.length` gives the completed-quest count directly; `calcEstimatedVsActualStoryPoints` (imported from `@/lib/statistics`, same as Statistics page) gives `{ estimated, actualHours }` — it already internally re-checks `status === "done"`, which is redundant but harmless here.

## 4. UI

New `<section>` after the "Active Sprint" block (before "Recent Activities"), same visual pattern as other Dashboard sections (`border-2 border-border bg-card p-4`, tracking-widest label header):

```
◆ THIS WEEK
[N] quests completed   [E] SP estimated   vs   [A]h actual
```

- Header color: `--color-primary-gold` (matches other section headers like "Recent Activities", "Active Sprint" title accents).
- If `doneThisWeek.length === 0`: still render the section with `0 quests completed · 0 SP estimated · 0h actual` — an honest empty state, not hidden (consistent with how other Dashboard panels behave, e.g. "Waiting External" renders "[ NONE ]" rather than disappearing). Exception: unlike the optional `activeSprint`/`recentWins`/`activityLogs` blocks (which only render when there's live data to show, since an empty sprint/activity section has nothing meaningful to say), this panel's three numbers are meaningful even at zero — "you completed nothing this week" is itself useful signal for a personal productivity tool.

## 5. Testing

No new pure-logic function is introduced (the filter is a 5-line inline `useMemo`, not worth extracting), so no new unit test file. `calcEstimatedVsActualStoryPoints` itself is already covered in `src/lib/statistics.test.ts`. Manual verification: run the app, confirm the panel renders with real task data and numbers match the Statistics page's own "SP EST. VS. ACTUAL" row when both are computed over the same trailing-7-day task subset.

## 6. Files touched

- `src/app/(dashboard)/dashboard/page.tsx` — add `now`/`doneThisWeek`/`weeklyStoryPoints` memos, import `calcEstimatedVsActualStoryPoints` and `completedAt` (latter already imported), add the new section.
- `docs/01-product.md` §9.4 — update "Status" line to remove the gap note once shipped.
- `docs/05-backlog.md` §6 — mark the EPIC-13 finding as fixed.
