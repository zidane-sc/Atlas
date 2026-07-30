import { describe, expect, it } from "vitest";
import { applyTaskFilters, countActiveFilters, EMPTY_TASK_FILTERS } from "./task-filters";
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

  it("ANDs across facets", () => {
    const result = applyTaskFilters(tasks, { ...EMPTY_TASK_FILTERS, projects: ["ATS"], priorities: ["p0"] });
    expect(result.map((t) => t.id)).toEqual(["a"]);
  });

  it("matches free-text query against title and tags", () => {
    expect(applyTaskFilters(tasks, { ...EMPTY_TASK_FILTERS, query: "docs" }).map((t) => t.id)).toEqual(["b"]);
    expect(applyTaskFilters(tasks, { ...EMPTY_TASK_FILTERS, query: "urgent" }).map((t) => t.id)).toEqual(["a"]);
  });

  it("combines every facet together (AND)", () => {
    const result = applyTaskFilters(tasks, {
      statuses: ["waiting_external"],
      priorities: ["p1"],
      projects: ["ATS"],
      types: ["deployment"],
      query: "release",
    });
    expect(result.map((t) => t.id)).toEqual(["c"]);
  });
});

describe("countActiveFilters", () => {
  it("is 0 for the empty filter set", () => {
    expect(countActiveFilters(EMPTY_TASK_FILTERS)).toBe(0);
  });

  it("counts each selected value and a non-empty query as one facet each", () => {
    expect(
      countActiveFilters({ statuses: ["blocked", "done"], priorities: ["p0"], projects: [], types: [], query: "x" })
    ).toBe(4);
  });
});
