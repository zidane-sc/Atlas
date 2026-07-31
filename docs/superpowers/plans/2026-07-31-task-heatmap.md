# Task Heatmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a GitHub-style activity heatmap card to the top of the Statistics page, showing task completions per day over the trailing 52 weeks with a hover tooltip.

**Architecture:** A pure, unit-tested helper `buildHeatmapGrid` in `src/lib/statistics.ts` turns `tasks` + an anchor date into a 52-week × 7-day grid of per-day completion counts. A zero-dependency React component `ActivityHeatmap` renders that grid with 4-shade intensity colors, weekday/month labels, a legend, and a custom hover tooltip. The Statistics page imports and places the card above the KPI grid.

**Tech Stack:** React 19, Next.js 16, TypeScript, vitest (node environment). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-31-task-heatmap-design.md`

## Global Constraints

- No new dependencies — custom React + CSS grid, no recharts for the heatmap itself.
- Dates are local dates via `formatLocalDate` / `parseLocalDate` from `src/lib/gamification.ts` (matches streak/achievement convention).
- Completions come from `completedAt(task)` (`src/lib/gamification.ts`).
- Colors are literal hex (recharts proved CSS custom properties don't resolve reliably as SVG presentation attributes; the heatmap uses inline `style`, but literal hex keeps parity with existing charts).
- Empty + 4 intensity shades; intensity = `ceil((count / maxCount) * 4)` clamped to 1..4.
- Tooltip styled like the existing `TOOLTIP_STYLE`: `var(--color-bg-panel)` background, `2px solid var(--color-primary-gold)` border, `var(--color-text-primary)` text, `VT323, monospace` font.
- Run `npm test`, `npm run lint`, and `npm run build` at the end of the last task.

---

### Task 1: `buildHeatmapGrid` pure helper with tests

**Files:**
- Create: `src/lib/statistics.ts`
- Test: `src/lib/statistics.test.ts`

**Interfaces:**
- Consumes: `Task` from `@/types/task`; `completedAt`, `formatLocalDate`, `parseLocalDate` from `./gamification`.
- Produces:
  - `interface HeatmapDayCell { date: string; count: number }`
  - `interface HeatmapGrid { weeks: HeatmapDayCell[][]; maxCount: number }`
  - `buildHeatmapGrid(tasks: Task[], nowAnchor: string): HeatmapGrid`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/statistics.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildHeatmapGrid } from "./statistics";
import type { Task } from "@/types/task";

function task(overrides: Partial<Task> & Pick<Task, "id" | "priority" | "type" | "status">): Task {
  return {
    title: "Test task",
    project: "Test",
    tags: [],
    relations: [],
    attachments: [],
    deliverables: [],
    pinned: false,
    statusHistory: [],
    ...overrides,
  };
}

const ANCHOR = "2026-07-31";

function cellFor(grid: { weeks: { date: string; count: number }[][] }, date: string) {
  return grid.weeks.flat().find((c) => c.date === date);
}

describe("buildHeatmapGrid", () => {
  it("produces a 52x7 grid of zero-count cells for no completions", () => {
    const grid = buildHeatmapGrid([], ANCHOR);
    expect(grid.weeks).toHaveLength(52);
    grid.weeks.forEach((week) => expect(week).toHaveLength(7));
    expect(grid.weeks.flat().every((c) => c.count === 0)).toBe(true);
    expect(grid.maxCount).toBe(0);
  });

  it("starts the window on the Sunday 51 weeks before the anchor week", () => {
    const grid = buildHeatmapGrid([], ANCHOR);
    expect(grid.weeks[0][0].date).toBe("2025-08-03");
  });

  it("places a single completion in the matching day cell", () => {
    const tasks = [task({ id: "t1", priority: "p2", type: "coding", status: "done", completedAt: "2026-03-15T12:00:00" })];
    const grid = buildHeatmapGrid(tasks, ANCHOR);
    expect(cellFor(grid, "2026-03-15")?.count).toBe(1);
    expect(grid.maxCount).toBe(1);
  });

  it("aggregates multiple completions on the same day", () => {
    const base = { priority: "p2", type: "coding", status: "done" } as const;
    const tasks = [
      task({ id: "t1", ...base, completedAt: "2026-03-15T09:00:00" }),
      task({ id: "t2", ...base, completedAt: "2026-03-15T15:00:00" }),
    ];
    const grid = buildHeatmapGrid(tasks, ANCHOR);
    expect(cellFor(grid, "2026-03-15")?.count).toBe(2);
    expect(grid.maxCount).toBe(2);
  });

  it("ignores completions before the window starts", () => {
    const tasks = [task({ id: "t1", priority: "p2", type: "coding", status: "done", completedAt: "2025-08-02T12:00:00" })];
    const grid = buildHeatmapGrid(tasks, ANCHOR);
    expect(grid.weeks.flat().every((c) => c.count === 0)).toBe(true);
    expect(grid.maxCount).toBe(0);
  });

  it("includes completions on the anchor date", () => {
    const tasks = [task({ id: "t1", priority: "p2", type: "coding", status: "done", completedAt: "2026-07-31T10:00:00" })];
    const grid = buildHeatmapGrid(tasks, ANCHOR);
    expect(cellFor(grid, "2026-07-31")?.count).toBe(1);
  });

  it("tracks the peak single-day count as maxCount", () => {
    const mk = (id: string, at: string) => task({ id, priority: "p2", type: "coding", status: "done", completedAt: at });
    const grid = buildHeatmapGrid(
      [
        mk("a", "2026-03-10T08:00:00"),
        mk("b", "2026-03-10T09:00:00"),
        mk("c", "2026-03-10T10:00:00"),
        mk("d", "2026-03-11T08:00:00"),
        mk("e", "2026-03-11T09:00:00"),
      ],
      ANCHOR
    );
    expect(grid.maxCount).toBe(3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/statistics.test.ts`
Expected: FAIL — module `./statistics` not found / `buildHeatmapGrid` not exported.

- [ ] **Step 3: Write the minimal implementation**

Create `src/lib/statistics.ts`:

```ts
import type { Task } from "@/types/task";
import { completedAt, formatLocalDate, parseLocalDate } from "./gamification";

export interface HeatmapDayCell {
  date: string;
  count: number;
}

export interface HeatmapGrid {
  weeks: HeatmapDayCell[][];
  maxCount: number;
}

/**
 * Per-day completion counts for the trailing 52 weeks, grouped into weeks of
 * 7 cells each (Sun..Sat), ending on the Sunday of the anchor week.
 */
export function buildHeatmapGrid(tasks: Task[], nowAnchor: string): HeatmapGrid {
  const counts = new Map<string, number>();
  for (const t of tasks) {
    const at = completedAt(t);
    if (!at) continue;
    const day = formatLocalDate(at);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }

  const anchor = parseLocalDate(nowAnchor);
  const end = new Date(anchor);
  end.setDate(end.getDate() - end.getDay());
  const start = new Date(end);
  start.setDate(start.getDate() - 51 * 7);

  const weeks: HeatmapDayCell[][] = [];
  let maxCount = 0;
  const cursor = new Date(start);
  for (let w = 0; w < 52; w++) {
    const week: HeatmapDayCell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = formatLocalDate(cursor);
      const count = counts.get(date) ?? 0;
      if (count > maxCount) maxCount = count;
      week.push({ date, count });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }

  return { weeks, maxCount };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/statistics.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/statistics.ts src/lib/statistics.test.ts
git commit -m "feat: add buildHeatmapGrid statistics helper with tests"
```

---

### Task 2: `ActivityHeatmap` component

**Files:**
- Create: `src/components/statistics/ActivityHeatmap.tsx`

**Interfaces:**
- Consumes: `Task` from `@/types/task`; `buildHeatmapGrid`, `HeatmapGrid` from `@/lib/statistics`; `parseLocalDate` from `@/lib/gamification`.
- Produces: `ActivityHeatmap({ tasks: Task[]; nowAnchor: string }): JSX.Element`

- [ ] **Step 1: Write the component**

Create `src/components/statistics/ActivityHeatmap.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import type { Task } from "@/types/task";
import { parseLocalDate } from "@/lib/gamification";
import { buildHeatmapGrid } from "@/lib/statistics";

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** 0 = empty cell, then 4 ascending intensity shades toward --color-status-ready (#4ecca3). */
const HEAT_COLORS = ["#1b2029", "#1f6f50", "#23926d", "#37b589", "#4ecca3"];

const WEEKDAY_LABELS = [
  { d: 1, label: "Mon" },
  { d: 3, label: "Wed" },
  { d: 5, label: "Fri" },
];

const CELL = 11;
const GAP = 3;

function levelFor(count: number, maxCount: number): number {
  if (count <= 0 || maxCount <= 0) return 0;
  return Math.min(4, Math.ceil((count / maxCount) * 4));
}

function formatDateDisplay(dateStr: string): string {
  return parseLocalDate(dateStr).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface TooltipState {
  date: string;
  count: number;
  left: number;
  top: number;
}

export default function ActivityHeatmap({ tasks, nowAnchor }: { tasks: Task[]; nowAnchor: string }) {
  const grid = useMemo(() => buildHeatmapGrid(tasks, nowAnchor), [tasks, nowAnchor]);
  const [tip, setTip] = useState<TooltipState | null>(null);

  const monthLabels = useMemo(() => {
    const labels: { label: string; start: number; end: number }[] = [];
    let prevMonth = "";
    grid.weeks.forEach((week, w) => {
      const monthKey = week[0].date.slice(0, 7);
      if (monthKey !== prevMonth) {
        labels.push({ label: MONTH_ABBR[Number(week[0].date.slice(5, 7)) - 1], start: w, end: w });
        prevMonth = monthKey;
      } else if (labels.length > 0) {
        labels[labels.length - 1].end = w;
      }
    });
    return labels;
  }, [grid]);

  return (
    <div className="border-2 border-border bg-card p-4">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm tracking-widest" style={{ color: "var(--color-status-ready)" }}>▸ ACTIVITY HEATMAP</span>
        <div className="flex items-center gap-1 text-sm" style={{ color: "var(--color-dim)" }}>
          <span className="mr-1">LESS</span>
          {HEAT_COLORS.map((c, i) => (
            <span key={i} className="inline-block h-[10px] w-[10px]" style={{ backgroundColor: c }} />
          ))}
          <span className="ml-1">MORE</span>
        </div>
      </div>

      <div className="overflow-x-auto pb-1">
        <div
          className="relative inline-grid"
          style={{
            gridTemplateColumns: `30px repeat(52, ${CELL}px)`,
            gridTemplateRows: `14px repeat(7, ${CELL}px)`,
            gap: GAP,
          }}
        >
          {monthLabels.map((m) => (
            <div
              key={m.start}
              style={{
                gridColumn: `${m.start + 2} / ${m.end + 3}`,
                gridRow: 1,
                fontSize: 9,
                lineHeight: "14px",
                color: "var(--color-text-muted)",
                fontFamily: "VT323, monospace",
                whiteSpace: "nowrap",
                overflow: "hidden",
              }}
            >
              {m.label}
            </div>
          ))}

          {WEEKDAY_LABELS.map(({ d, label }) => (
            <div
              key={label}
              style={{
                gridColumn: 1,
                gridRow: d + 2,
                fontSize: 9,
                lineHeight: `${CELL}px`,
                color: "var(--color-text-muted)",
                fontFamily: "VT323, monospace",
                textAlign: "right",
                paddingRight: 4,
              }}
            >
              {label}
            </div>
          ))}

          {grid.weeks.map((week, w) =>
            week.map((cell, d) => (
              <div
                key={cell.date}
                onMouseEnter={(e) => {
                  const el = e.currentTarget;
                  setTip({
                    date: cell.date,
                    count: cell.count,
                    left: el.offsetLeft + el.offsetWidth + GAP,
                    top: el.offsetTop,
                  });
                }}
                onMouseLeave={() => setTip(null)}
                style={{
                  gridColumn: w + 2,
                  gridRow: d + 2,
                  width: CELL,
                  height: CELL,
                  backgroundColor: HEAT_COLORS[levelFor(cell.count, grid.maxCount)],
                }}
              />
            ))
          )}

          {tip && (
            <div
              className="pointer-events-none absolute z-10 px-2 py-1"
              style={{
                left: tip.left,
                top: tip.top,
                backgroundColor: "var(--color-bg-panel)",
                border: "2px solid var(--color-primary-gold)",
                color: "var(--color-text-primary)",
                fontFamily: "VT323, monospace",
                fontSize: "12px",
                lineHeight: "1.2",
              }}
            >
              <div>{formatDateDisplay(tip.date)}</div>
              <div>{tip.count} {tip.count === 1 ? "task" : "tasks"} completed</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it type-checks and lints**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/statistics/ActivityHeatmap.tsx
git commit -m "feat: add ActivityHeatmap component"
```

---

### Task 3: Wire the heatmap into the Statistics page

**Files:**
- Modify: `src/app/(dashboard)/statistics/page.tsx`

**Interfaces:**
- Consumes: `ActivityHeatmap` from `@/components/statistics/ActivityHeatmap`; existing `allTasks`, `nowAnchor` in `Page()`.

- [ ] **Step 1: Import the component**

In `src/app/(dashboard)/statistics/page.tsx`, add an import after the existing imports (e.g. after line 11, the `TYPE_ICON` import):

```ts
import ActivityHeatmap from "@/components/statistics/ActivityHeatmap";
```

- [ ] **Step 2: Render the heatmap card above the KPI grid**

In the `Page()` return, inside the `<div className="flex flex-col gap-5">` container (currently the first child is the KPI grid `<div className="grid grid-cols-2 gap-3 md:grid-cols-4">`), insert the heatmap as the first child:

```tsx
<div className="flex flex-col gap-5">
  <ActivityHeatmap tasks={allTasks} nowAnchor={nowAnchor} />
  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
```

- [ ] **Step 3: Verify build, tests, and lint**

Run: `npm test && npm run lint && npm run build`
Expected: all pass with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/statistics/page.tsx
git commit -m "feat: add task heatmap to statistics page"
```

---

## Self-Review

- **Spec coverage:** pure helper (lib/statistics.ts) ✓ Task 1; component + tooltip + legend + month/weekday labels ✓ Task 2; full-width card placement above KPI grid ✓ Task 3; 4-shade intensity + empty ✓ Task 1/2; hover tooltip styled like TOOLTIP_STYLE ✓ Task 2; edge cases (empty, out-of-window, maxCount peak) ✓ Task 1 tests; `npm test` verification ✓ Task 3.
- **Placeholder scan:** every step has concrete code or exact commands; no TBD/TODO.
- **Type consistency:** `buildHeatmapGrid` returns `{ weeks, maxCount }`; `HeatmapDayCell` = `{ date, count }`; `levelFor` indexes `HEAT_COLORS[0..4]`; `ActivityHeatmap` props `{ tasks, nowAnchor }` match the page's `allTasks` and `nowAnchor`. Verified consistent across all tasks.
