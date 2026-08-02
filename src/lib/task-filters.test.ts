import { describe, expect, it } from "vitest";
import { applyTaskFilters, countActiveFilters, EMPTY_TASK_FILTERS, normalizeFilters, type TaskFilters } from "./task-filters";
import type { Task } from "@/types/task";

function task(overrides: Partial<Task>): Task {
  return {
    id: overrides.id ?? "t1",
    title: "Task",
    project: "Atlas",
    status: "todo",
    type: "coding",
    priority: "p2",
    tags: [],
    relations: [],
    attachments: [],
    deliverables: [],
    statusHistory: [],
    ...overrides,
  };
}

describe("applyTaskFilters", () => {
  const tasks: Task[] = [
    task({ id: "a", title: "Fix login bug", project: "ATS", status: "blocked", priority: "p0", type: "bug", tags: ["urgent"] }),
    task({ id: "b", title: "Write docs", project: "Atlas", status: "todo", priority: "p2", type: "documentation", tags: [] }),
    task({ id: "c", title: "Deploy release", project: "ATS", status: "waiting_external", priority: "p1", type: "deployment", tags: ["release"] }),
  ];

  it("returns everything when no filters are set", () => {
    expect(applyTaskFilters(tasks, EMPTY_TASK_FILTERS)).toHaveLength(3);
  });

  it("ORs within a single facet", () => {
    const result = applyTaskFilters(tasks, { ...EMPTY_TASK_FILTERS, statuses: ["blocked", "waiting_external"] });
    expect(result.map((t) => t.id).sort()).toEqual(["a", "c"]);
  });

  it("ANDs across facets by default", () => {
    const result = applyTaskFilters(tasks, { ...EMPTY_TASK_FILTERS, projects: ["ATS"], priorities: ["p0"] });
    expect(result.map((t) => t.id)).toEqual(["a"]);
  });

  it("matches free-text query against title and tags", () => {
    expect(applyTaskFilters(tasks, { ...EMPTY_TASK_FILTERS, query: "docs" }).map((t) => t.id)).toEqual(["b"]);
    expect(applyTaskFilters(tasks, { ...EMPTY_TASK_FILTERS, query: "urgent" }).map((t) => t.id)).toEqual(["a"]);
  });

  it("matches free-text query against project name", () => {
    expect(applyTaskFilters(tasks, { ...EMPTY_TASK_FILTERS, query: "atlas" }).map((t) => t.id)).toEqual(["b"]);
  });

  it("combines every facet together (AND)", () => {
    const result = applyTaskFilters(tasks, {
      ...EMPTY_TASK_FILTERS,
      statuses: ["waiting_external"],
      priorities: ["p1"],
      projects: ["ATS"],
      types: ["deployment"],
      query: "release",
    });
    expect(result.map((t) => t.id)).toEqual(["c"]);
  });

  it("combines active facets with OR when combineMode is OR — docs/01-product.md §9.3", () => {
    const result = applyTaskFilters(tasks, {
      ...EMPTY_TASK_FILTERS,
      combineMode: "OR",
      statuses: ["blocked"],
      types: ["deployment"],
    });
    expect(result.map((t) => t.id).sort()).toEqual(["a", "c"]);
  });

  it("filters by tag facet, independent of the free-text query", () => {
    const result = applyTaskFilters(tasks, { ...EMPTY_TASK_FILTERS, tags: ["release"] });
    expect(result.map((t) => t.id)).toEqual(["c"]);
  });

  it("statusOp is_not excludes the selected statuses instead of requiring them", () => {
    const result = applyTaskFilters(tasks, { ...EMPTY_TASK_FILTERS, statuses: ["todo"], statusOp: "is_not" });
    expect(result.map((t) => t.id).sort()).toEqual(["a", "c"]);
  });

  it("priorityOp gte matches everything at least as urgent as the selected priority", () => {
    const result = applyTaskFilters(tasks, { ...EMPTY_TASK_FILTERS, priorities: ["p1"], priorityOp: "gte" });
    expect(result.map((t) => t.id).sort()).toEqual(["a", "c"]);
  });

  it("priorityOp lte matches everything at most as urgent as the selected priority", () => {
    const result = applyTaskFilters(tasks, { ...EMPTY_TASK_FILTERS, priorities: ["p1"], priorityOp: "lte" });
    expect(result.map((t) => t.id).sort()).toEqual(["b", "c"]);
  });

  it("normalizes a saved filter missing newer fields instead of crashing", () => {
    const legacy = { statuses: [], priorities: [], projects: ["ATS"], types: [], query: "" } as unknown as TaskFilters;
    expect(applyTaskFilters(tasks, legacy).map((t) => t.id).sort()).toEqual(["a", "c"]);
  });
});

describe("countActiveFilters", () => {
  it("is 0 for the empty filter set", () => {
    expect(countActiveFilters(EMPTY_TASK_FILTERS)).toBe(0);
  });

  it("counts each selected value and a non-empty query as one facet each", () => {
    expect(
      countActiveFilters({ ...EMPTY_TASK_FILTERS, statuses: ["blocked", "done"], priorities: ["p0"], query: "x" })
    ).toBe(4);
  });

  it("counts tag selections too", () => {
    expect(countActiveFilters({ ...EMPTY_TASK_FILTERS, tags: ["backend", "urgent"] })).toBe(2);
  });
});

describe("normalizeFilters", () => {
  it("fills in missing fields with the old defaults", () => {
    const legacy = { statuses: ["done"], priorities: [], projects: [], types: [], query: "" } as unknown as TaskFilters;
    expect(normalizeFilters(legacy)).toEqual({ ...EMPTY_TASK_FILTERS, statuses: ["done"] });
  });
});
