# Task Heatmap — Design

**Date:** 2026-07-31
**Status:** Approved
**Feature:** GitHub-style activity heatmap on the Statistics page

## Goal

Add a full-width, GitHub-style "task heatmap" card to the top of the Statistics page
(`src/app/(dashboard)/statistics/page.tsx`). Each cell represents one day over the trailing
52 weeks, colored by the number of tasks completed that day. Hovering a cell shows a tooltip
with the date and completion count.

## Requirements

- Cell metric: number of tasks completed that day (`completedAt(task)`).
- Time span: trailing 52 weeks, ending on the current anchor date.
- Color scale: empty + 4 intensity shades; intensity computed by bucketing the day's count
  against the maximum single-day count within the 52-week window.
- Hover tooltip: date + completion count, styled to match the existing recharts
  `TOOLTIP_STYLE` (dark panel, gold border, VT323).
- Placement: new full-width card at the top of the Statistics page, above the KPI grid,
  matching existing panel styling (`border-2 border-border bg-card p-4`).
- No new dependencies — custom React + CSS grid component.

## Architecture

### 1. Pure helper — `src/lib/statistics.ts`

Exported for unit testing:

```
buildHeatmapGrid(tasks: Task[], nowAnchor: string): HeatmapGrid
```

- `HeatmapGrid` = `{ cells: { date: string; count: number }[]; weeks: Week[]; maxCount: number }`
  where `Week = DayCell[]` (7 rows, one per weekday).
- Iterates `tasks`, using `completedAt(task)` (from `src/lib/gamification.ts`); skips tasks
  without a completion date.
- Groups by local date via `formatLocalDate()` (matching the streak/achievement convention).
- Window: the Sunday on or before `nowAnchor`, minus 51 weeks (52 weeks total). Completions
  outside the window are clamped/ignored.
- `maxCount` = maximum per-day count within the window (`0` if none).
- Returns an ordered grid: weeks as columns, weekday rows (Sun–Sat).

### 2. Component — `src/components/statistics/ActivityHeatmap.tsx`

Client component:

- Props: `{ tasks: Task[]; nowAnchor: string }`.
- Calls `buildHeatmapGrid`, then renders a CSS grid:
  - Weeks as columns, 7 rows; ~10px cells with a small gap.
  - Left column: weekday labels (Mon / Wed / Fri).
  - Top row: month labels across the year.
  - Intensity colors: 4 literal hex teal/green shades plus an empty-cell fill, mirroring
    `globals.css` and the existing `CHART_COLORS` convention (recharts proved raw CSS custom
    properties don't resolve reliably as SVG presentation attributes; the grid cells use
    inline `style` so CSS vars would work, but literal hex keeps parity with the page's
    existing charts).
  - Intensity bucketing: `count === 0` → empty; else divide `count / maxCount` into 4 equal
    bands (25% steps).
  - Legend in the header row: empty cell → shade 4, labeled "0" → "more".
- Tooltip: single `useState` holding `{ date, count, x, y }`; cells set it on `onMouseEnter`,
  clear on `onMouseLeave`. Absolutely positioned within the card, styled with
  `var(--color-bg-panel)`, `2px solid var(--color-primary-gold)` border, VT323 font — the
  same look as `TOOLTIP_STYLE`.

### 3. Wiring — `src/app/(dashboard)/statistics/page.tsx`

- Import `ActivityHeatmap`.
- Place the card as the first child inside the scrollable content (`flex flex-col gap-5`),
  above the KPI grid.
- Pass `tasks={allTasks}` and `nowAnchor` (the existing `nowAnchor` memo).

## Data flow

```
tasks + nowAnchor
  → buildHeatmapGrid()  (lib/statistics.ts, pure, tested)
  → ActivityHeatmap     (renders grid + tooltip + legend)
  → statistics/page.tsx (passes data, positions card)
```

## Edge cases

- `maxCount === 0` (no completions in window): all cells empty; legend still renders; tooltip
  shows "0 tasks completed".
- Future-dated mock completions: covered because `nowAnchor` derives from `nowTime`
  (max of `Date.now()` and the latest completion), so the window includes them.
- Completions before the window: ignored (clamped out).
- Local vs UTC: uses local dates (`formatLocalDate`), consistent with streak and achievement
  logic. Note the existing Weekly Throughput chart uses UTC day buckets; the heatmap keeps
  local dates to match the dominant convention.

## Testing

- New `src/lib/statistics.test.ts` (vitest, matching existing `src/lib/*.test.ts` style):
  - Empty tasks → all cells count 0, `maxCount` 0.
  - A single completion lands in the correct cell/date.
  - Multiple completions same day aggregate to one count.
  - Completion outside the 52-week window is excluded.
- Component render test is not required (no component tests exist in the repo).
- Run `npm test` to verify.

## Out of scope

- Click-through to a day's tasks.
- Month-view or configurable ranges.
- XP/coins intensity variant.
- UTC bucket alignment with the Weekly Throughput chart.
