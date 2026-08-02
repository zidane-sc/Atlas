import { describe, expect, it } from "vitest";
import {
  buildHeatmapGrid,
  buildProductivityProfile,
  calcAverageTaskDurationDays,
  calcCompletionRate,
  calcEstimatedVsActualStoryPoints,
  calcFocusHours,
} from "./statistics";
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

  it("ends the window on the Saturday of the anchor week", () => {
    const grid = buildHeatmapGrid([], ANCHOR);
    expect(grid.weeks[51][6].date).toBe("2026-08-01");
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

  it("includes a completion exactly on the window start", () => {
    const tasks = [task({ id: "t1", priority: "p2", type: "coding", status: "done", completedAt: "2025-08-03T09:00:00" })];
    const grid = buildHeatmapGrid(tasks, ANCHOR);
    expect(cellFor(grid, "2025-08-03")?.count).toBe(1);
  });

  it("excludes completions after the anchor week", () => {
    const tasks = [task({ id: "t1", priority: "p2", type: "coding", status: "done", completedAt: "2026-08-02T09:00:00" })];
    const grid = buildHeatmapGrid(tasks, ANCHOR);
    expect(grid.weeks.flat().every((c) => c.count === 0)).toBe(true);
    expect(grid.maxCount).toBe(0);
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

describe("calcCompletionRate", () => {
  it("returns 0 for an empty task list", () => {
    expect(calcCompletionRate([])).toBe(0);
  });

  it("is the percentage of all tasks currently done", () => {
    const tasks = [
      task({ id: "a", priority: "p2", type: "coding", status: "done" }),
      task({ id: "b", priority: "p2", type: "coding", status: "done" }),
      task({ id: "c", priority: "p2", type: "coding", status: "todo" }),
      task({ id: "d", priority: "p2", type: "coding", status: "in_progress" }),
    ];
    expect(calcCompletionRate(tasks)).toBe(50);
  });
});

describe("calcFocusHours", () => {
  it("sums timeSpentSeconds across all tasks, in hours", () => {
    const tasks = [
      task({ id: "a", priority: "p2", type: "coding", status: "done", timeSpentSeconds: 3600 }),
      task({ id: "b", priority: "p2", type: "coding", status: "in_progress", timeSpentSeconds: 1800 }),
    ];
    expect(calcFocusHours(tasks)).toBe(1.5);
  });

  it("is 0 when nothing has been timed", () => {
    expect(calcFocusHours([task({ id: "a", priority: "p2", type: "coding", status: "todo" })])).toBe(0);
  });
});

describe("calcAverageTaskDurationDays", () => {
  it("returns null when no done task has both a created and completed timestamp", () => {
    expect(calcAverageTaskDurationDays([])).toBeNull();
  });

  it("averages calendar days from first status-log entry to completion", () => {
    const tasks = [
      task({
        id: "a",
        priority: "p2",
        type: "coding",
        status: "done",
        statusHistory: [
          { fromStatus: null, toStatus: "todo", changedAt: "2026-07-01T10:00:00Z" },
          { fromStatus: "todo", toStatus: "done", changedAt: "2026-07-03T10:00:00Z" },
        ],
      }),
      task({
        id: "b",
        priority: "p2",
        type: "coding",
        status: "done",
        statusHistory: [
          { fromStatus: null, toStatus: "todo", changedAt: "2026-07-01T10:00:00Z" },
          { fromStatus: "todo", toStatus: "done", changedAt: "2026-07-02T10:00:00Z" },
        ],
      }),
    ];
    // task a: 2 days, task b: 1 day → average 1.5
    expect(calcAverageTaskDurationDays(tasks)).toBe(1.5);
  });
});

describe("calcEstimatedVsActualStoryPoints", () => {
  it("only counts done tasks with a story point set", () => {
    const tasks = [
      task({ id: "a", priority: "p2", type: "coding", status: "done", storyPoint: 5, timeSpentSeconds: 3600 * 3 }),
      task({ id: "b", priority: "p2", type: "coding", status: "done", storyPoint: 3, timeSpentSeconds: 3600 }),
      task({ id: "c", priority: "p2", type: "coding", status: "in_progress", storyPoint: 8, timeSpentSeconds: 3600 * 5 }),
      task({ id: "d", priority: "p2", type: "coding", status: "done", timeSpentSeconds: 3600 }),
    ];
    expect(calcEstimatedVsActualStoryPoints(tasks)).toEqual({ estimated: 8, actualHours: 4 });
  });
});

describe("buildProductivityProfile", () => {
  it("returns nulls when nothing has been completed", () => {
    expect(buildProductivityProfile([])).toEqual({
      bestWeekday: null,
      bestWeekdayCount: 0,
      bestPeriod: null,
      bestPeriodCount: 0,
    });
  });

  it("finds the weekday with the most completions", () => {
    const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const majorityAt = "2026-07-06T12:00:00Z";
    const expectedWeekday = WEEKDAY_NAMES[new Date(majorityAt).getDay()];
    const tasks = [
      task({ id: "a", priority: "p2", type: "coding", status: "done", completedAt: majorityAt }),
      task({ id: "b", priority: "p2", type: "coding", status: "done", completedAt: majorityAt }),
      task({ id: "c", priority: "p2", type: "coding", status: "done", completedAt: "2026-07-08T12:00:00Z" }),
    ];
    const profile = buildProductivityProfile(tasks);
    expect(profile.bestWeekday).toBe(expectedWeekday);
    expect(profile.bestWeekdayCount).toBe(2);
  });

  it("finds the time-of-day period with the most completions", () => {
    const tasks = [
      task({ id: "a", priority: "p2", type: "coding", status: "done", completedAt: "2026-07-06T08:00:00Z" }),
      task({ id: "b", priority: "p2", type: "coding", status: "done", completedAt: "2026-07-07T09:00:00Z" }),
      task({ id: "c", priority: "p2", type: "coding", status: "done", completedAt: "2026-07-08T20:00:00Z" }),
    ];
    const profile = buildProductivityProfile(tasks);
    expect(profile.bestPeriodCount).toBe(2);
    expect(profile.bestPeriod).toMatch(/Morning|Afternoon|Evening|Night/);
  });
});
