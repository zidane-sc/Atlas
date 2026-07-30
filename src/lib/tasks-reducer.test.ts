import { describe, expect, it } from "vitest";
import { tasksReducer } from "./tasks-reducer";
import type { TaskFormValues } from "@/lib/schemas/task";
import type { Task } from "@/types/task";

function values(overrides: Partial<TaskFormValues> = {}): TaskFormValues {
  return {
    title: "New quest",
    project: "Atlas",
    status: "inbox",
    type: "coding",
    priority: "p2",
    tags: [],
    relations: [],
    attachments: [],
    deliverables: [],
    ...overrides,
  };
}

describe("tasksReducer create — docs/04-development.md §3", () => {
  it("assigns the given id and seeds a single statusHistory row with no fromStatus", () => {
    const result = tasksReducer([], { type: "create", id: "t1", changedAt: "2026-01-01T00:00:00Z", values: values() });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "t1", title: "New quest", project: "Atlas" });
    expect(result[0].statusHistory).toEqual([
      { fromStatus: null, toStatus: "inbox", changedAt: "2026-01-01T00:00:00Z" },
    ]);
  });

  it("prepends the new task without disturbing existing ones", () => {
    const existing: Task[] = [
      {
        id: "t0",
        title: "Existing",
        project: "Atlas",
        status: "todo",
        type: "coding",
        priority: "p2",
        tags: [],
        relations: [],
        attachments: [],
        deliverables: [],
        statusHistory: [],
      },
    ];
    const result = tasksReducer(existing, { type: "create", id: "t1", changedAt: "2026-01-01T00:00:00Z", values: values() });
    expect(result.map((t) => t.id)).toEqual(["t1", "t0"]);
  });
});

describe("tasksReducer update — status transitions always produce a log row", () => {
  const base: Task = {
    id: "t1",
    title: "Original",
    project: "Atlas",
    status: "todo",
    type: "coding",
    priority: "p2",
    tags: [],
    relations: [],
    attachments: [],
    deliverables: [],
    statusHistory: [{ fromStatus: null, toStatus: "todo", changedAt: "2026-01-01T00:00:00Z" }],
  };

  it("appends a statusHistory row when status changes", () => {
    const result = tasksReducer([base], {
      type: "update",
      id: "t1",
      changedAt: "2026-01-02T00:00:00Z",
      values: values({ status: "done" }),
    });
    expect(result[0].statusHistory).toEqual([
      { fromStatus: null, toStatus: "todo", changedAt: "2026-01-01T00:00:00Z" },
      { fromStatus: "todo", toStatus: "done", changedAt: "2026-01-02T00:00:00Z" },
    ]);
  });

  it("does not append a row when status is unchanged", () => {
    const result = tasksReducer([base], {
      type: "update",
      id: "t1",
      changedAt: "2026-01-02T00:00:00Z",
      values: values({ status: "todo", title: "Edited title" }),
    });
    expect(result[0].statusHistory).toHaveLength(1);
    expect(result[0].title).toBe("Edited title");
  });

  it("leaves other tasks untouched", () => {
    const other: Task = { ...base, id: "t2", title: "Untouched" };
    const result = tasksReducer([base, other], {
      type: "update",
      id: "t1",
      changedAt: "2026-01-02T00:00:00Z",
      values: values({ title: "Changed" }),
    });
    expect(result.find((t) => t.id === "t2")).toEqual(other);
  });

  it("replaces relations/attachments/deliverables wholesale from the form", () => {
    const result = tasksReducer([base], {
      type: "update",
      id: "t1",
      changedAt: "2026-01-02T00:00:00Z",
      values: values({
        relations: [{ relationType: "blocks", taskId: "t9", title: "Some blocker" }],
        attachments: [{ type: "github_pr", label: "PR #1", url: "https://example.com" }],
        deliverables: [{ type: "pr", label: "PR #1" }],
      }),
    });
    expect(result[0].relations).toEqual([{ relationType: "blocks", taskId: "t9", title: "Some blocker" }]);
    expect(result[0].attachments).toEqual([{ type: "github_pr", label: "PR #1", url: "https://example.com" }]);
    expect(result[0].deliverables).toEqual([{ type: "pr", label: "PR #1" }]);
  });
});

describe("tasksReducer delete", () => {
  it("removes only the matching task", () => {
    const t1: Task = {
      id: "t1", title: "A", project: "Atlas", status: "todo", type: "coding", priority: "p2",
      tags: [], relations: [], attachments: [], deliverables: [], statusHistory: [],
    };
    const t2: Task = { ...t1, id: "t2", title: "B" };
    const result = tasksReducer([t1, t2], { type: "delete", id: "t1" });
    expect(result.map((t) => t.id)).toEqual(["t2"]);
  });
});
