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
