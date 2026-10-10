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

function task(overrides: Partial<Omit<Task, "id">> & Pick<Task, "priority" | "type" | "status"> & { id: string }): Task {
  const { id, ...rest } = overrides;
  return {
    id,
    code: `TASK-${id}`,
    title: "Test task",
    project: "Test",
    tags: [],
    relations: [],
    attachments: [],
    deliverables: [],
    pinned: false,
    statusHistory: [],
    createdAt: "2026-01-01T00:00:00Z",
    ...rest,
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
    const tasks = [task({ id: "t1", priority: "medium", type: "coding", status: "done", completedAt: "2026-03-15T12:00:00" })];
    const grid = buildHeatmapGrid(tasks, ANCHOR);
    expect(cellFor(grid, "2026-03-15")?.count).toBe(1);
    expect(grid.maxCount).toBe(1);
  });

  it("aggregates multiple completions on the same day", () => {
    const base = { priority: "medium", type: "coding", status: "done" } as const;
    const tasks = [
      task({ id: "t1", ...base, completedAt: "2026-03-15T09:00:00" }),
      task({ id: "t2", ...base, completedAt: "2026-03-15T15:00:00" }),
    ];
    const grid = buildHeatmapGrid(tasks, ANCHOR);
    expect(cellFor(grid, "2026-03-15")?.count).toBe(2);
    expect(grid.maxCount).toBe(2);
  });

  it("ignores completions before the window starts", () => {
    const tasks = [task({ id: "t1", priority: "medium", type: "coding", status: "done", completedAt: "2025-08-02T12:00:00" })];
    const grid = buildHeatmapGrid(tasks, ANCHOR);
    expect(grid.weeks.flat().every((c) => c.count === 0)).toBe(true);
    expect(grid.maxCount).toBe(0);
  });

  it("includes completions on the anchor date", () => {
    const tasks = [task({ id: "t1", priority: "medium", type: "coding", status: "done", completedAt: "2026-07-31T10:00:00" })];
    const grid = buildHeatmapGrid(tasks, ANCHOR);
    expect(cellFor(grid, "2026-07-31")?.count).toBe(1);
  });

  it("includes a completion exactly on the window start", () => {
    const tasks = [task({ id: "t1", priority: "medium", type: "coding", status: "done", completedAt: "2025-08-03T09:00:00" })];
    const grid = buildHeatmapGrid(tasks, ANCHOR);
    expect(cellFor(grid, "2025-08-03")?.count).toBe(1);
  });

  it("excludes completions after the anchor week", () => {
    const tasks = [task({ id: "t1", priority: "medium", type: "coding", status: "done", completedAt: "2026-08-02T09:00:00" })];
    const grid = buildHeatmapGrid(tasks, ANCHOR);
    expect(grid.weeks.flat().every((c) => c.count === 0)).toBe(true);
    expect(grid.maxCount).toBe(0);
  });

  it("tracks the peak single-day count as maxCount", () => {
    const mk = (id: string, at: string) => task({ id, priority: "medium", type: "coding", status: "done", completedAt: at });
    const grid = buildHeatmapGrid(
      [
        mk("a", "2026-03-10T08:00:00"),
        mk("b", "2026-03-10T09:00:00"),
        mk("c", "2026-03-10T10:00:00"),
        mk("d", "2026-03-11T08:00:00"),
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

  it("computes the percentage of done tasks rounded to integer", () => {
    const tasks = [
      task({ id: "a", priority: "medium", type: "coding", status: "done" }),
      task({ id: "b", priority: "medium", type: "coding", status: "done" }),
      task({ id: "c", priority: "medium", type: "coding", status: "todo" }),
      task({ id: "d", priority: "medium", type: "coding", status: "in_progress" }),
    ];
    expect(calcCompletionRate(tasks)).toBe(50);
  });
});

describe("calcFocusHours", () => {
  it("sums timeSpentSeconds across all tasks and converts to hours rounded to 1 decimal", () => {
    const tasks = [
      task({ id: "a", priority: "medium", type: "coding", status: "done", timeSpentSeconds: 3600 }),
      task({ id: "b", priority: "medium", type: "coding", status: "in_progress", timeSpentSeconds: 1800 }),
    ];
    expect(calcFocusHours(tasks)).toBe(1.5);
  });

  it("returns 0 when no time has been tracked", () => {
    expect(calcFocusHours([task({ id: "a", priority: "medium", type: "coding", status: "todo" })])).toBe(0);
  });
});

describe("calcAverageTaskDurationDays", () => {
  it("computes average days between createdAt and completedAt for done tasks", () => {
    const tasks = [
      task({
        id: "a",
        priority: "medium",
        type: "coding",
        status: "done",
        createdAt: "2026-07-01T00:00:00Z",
        completedAt: "2026-07-03T00:00:00Z",
      }),
      task({
        id: "b",
        priority: "medium",
        type: "coding",
        status: "done",
        createdAt: "2026-07-01T00:00:00Z",
        completedAt: "2026-07-05T00:00:00Z",
      }),
    ];
    expect(calcAverageTaskDurationDays(tasks)).toBe(3);
  });
});

describe("calcEstimatedVsActualStoryPoints", () => {
  it("only counts done tasks with a size set", () => {
    const tasks = [
      task({ id: "a", priority: "medium", type: "coding", status: "done", size: "l", timeSpentSeconds: 3600 * 3 }),
      task({ id: "b", priority: "medium", type: "coding", status: "done", size: "s", timeSpentSeconds: 3600 }),
      task({ id: "c", priority: "medium", type: "coding", status: "in_progress", size: "xl", timeSpentSeconds: 3600 * 5 }),
      task({ id: "d", priority: "medium", type: "coding", status: "done", timeSpentSeconds: 3600 }),
    ];
    expect(calcEstimatedVsActualStoryPoints(tasks)).toEqual({ estimated: 7.5, actualHours: 4 });
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

  it("finds the day and time period with the most completions", () => {
    const majorityAt = "2026-07-07T14:30:00Z";
    const tasks = [
      task({ id: "a", priority: "medium", type: "coding", status: "done", completedAt: majorityAt }),
      task({ id: "b", priority: "medium", type: "coding", status: "done", completedAt: majorityAt }),
      task({ id: "c", priority: "medium", type: "coding", status: "done", completedAt: "2026-07-08T12:00:00Z" }),
    ];
    const profile = buildProductivityProfile(tasks);
    expect(profile.bestWeekday).toBe("Tuesday");
    expect(profile.bestWeekdayCount).toBe(2);
  });

  it("breaks ties deterministically by earliest matching day/period in order", () => {
    const tasks = [
      task({ id: "a", priority: "medium", type: "coding", status: "done", completedAt: "2026-07-06T08:00:00Z" }),
      task({ id: "b", priority: "medium", type: "coding", status: "done", completedAt: "2026-07-07T09:00:00Z" }),
      task({ id: "c", priority: "medium", type: "coding", status: "done", completedAt: "2026-07-08T20:00:00Z" }),
    ];
    const profile = buildProductivityProfile(tasks);
    expect(profile.bestWeekdayCount).toBe(1);
    expect(profile.bestPeriodCount).toBe(2);
  });
});
