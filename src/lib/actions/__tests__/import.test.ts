import { describe, expect, it } from "vitest";
import { validateImportPayload } from "@/lib/validation/import-validation";

describe("validateImportPayload", () => {
  it("returns counts for valid payload", () => {
    const payload = {
      tasks: [{ id: "1", title: "Task 1", status: "todo", type: "coding", priority: "p1" }],
      projects: [{ id: "p1", name: "Project 1", category: "work", colorVar: "red", status: "active" }],
      sprints: [],
      bonus: { xp: 0, coins: 0 },
    };
    const result = validateImportPayload(payload as any);
    expect(result.counts.tasks).toBe(1);
    expect(result.counts.projects).toBe(1);
    expect(result.errors).toEqual([]);
  });

  it("collects task validation errors without throwing", () => {
    const payload = {
      tasks: [
        { id: "1", title: "Bad Task", status: "invalid_status", type: "coding", priority: "p1" },
        { id: "2", title: "Bad Priority", status: "todo", type: "coding", priority: "p99" },
      ],
      projects: [],
      sprints: [],
      bonus: { xp: 0, coins: 0 },
    };
    const result = validateImportPayload(payload as any);
    expect(result.errors.length).toBe(2);
    expect(result.errors[0].category).toBe("Task");
    expect(result.errors[0].index).toBe(0);
    expect(result.errors[0].itemName).toBe("Bad Task");
    expect(result.errors[0].message).toContain("Invalid task status");
  });

  it("collects project and sprint errors", () => {
    const payload = {
      tasks: [],
      projects: [{ id: "p1", name: "Bad Project", status: "invalid" }],
      sprints: [{ id: "s1", name: "Bad Sprint", status: "invalid", startDate: "not-a-date", endDate: "also-not" }],
      bonus: { xp: 0, coins: 0 },
    };
    const result = validateImportPayload(payload as any);
    expect(result.errors.some(e => e.category === "Project")).toBe(true);
    expect(result.errors.some(e => e.category === "Sprint")).toBe(true);
  });
});
