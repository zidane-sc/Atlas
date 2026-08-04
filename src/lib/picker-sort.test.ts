import { describe, it, expect } from "vitest";
import { sortProjectsForPicker, sortSprintsForPicker, sortTasksForPicker } from "@/lib/picker-sort";
import type { Project, Sprint } from "@/types/gamification";
import type { Task } from "@/types/task";

const project = (name: string, status: Project["status"]): Project => ({
  id: name,
  name,
  colorVar: "var(--color-primary)",
  emoji: "★",
  category: "work",
  description: "",
  status,
});

const sprint = (name: string, startDate: string, status: Sprint["status"]): Sprint => ({
  id: name,
  name,
  projectIds: ["dummy-project"],
  startDate,
  endDate: "2026-12-31",
  status,
  goal: "",
});

const task = (title: string, status: Task["status"]): Task => ({
  id: title,
  title,
  project: "P",
  status,
  type: "coding",
  priority: "p2",
  pinned: false,
  tags: [],
  relations: [],
  attachments: [],
  deliverables: [],
  statusHistory: [],
});

describe("sortProjectsForPicker", () => {
  it("sorts by status rank then name", () => {
    const input = [
      project("Beta", "on_hold"),
      project("Gamma", "completed"),
      project("Alpha", "active"),
    ];
    expect(sortProjectsForPicker(input).map((p) => p.name)).toEqual(["Alpha", "Beta", "Gamma"]);
  });

  it("does not mutate the input array", () => {
    const input = [project("Beta", "on_hold"), project("Alpha", "active")];
    sortProjectsForPicker(input);
    expect(input.map((p) => p.name)).toEqual(["Beta", "Alpha"]);
  });
});

describe("sortSprintsForPicker", () => {
  it("sorts by status rank then start date", () => {
    const input = [
      sprint("Sprint 3", "2026-03-01", "planning"),
      sprint("Sprint 1", "2026-01-01", "active"),
      sprint("Sprint 2", "2026-02-01", "active"),
      sprint("Sprint 4", "2026-04-01", "completed"),
    ];
    expect(sortSprintsForPicker(input).map((s) => s.name)).toEqual(["Sprint 1", "Sprint 2", "Sprint 3", "Sprint 4"]);
  });
});

describe("sortTasksForPicker", () => {
  it("sorts incomplete first then title", () => {
    const input = [
      task("Zeta", "done"),
      task("Alpha", "inbox"),
      task("Milo", "done"),
      task("Beta", "in_progress"),
    ];
    expect(sortTasksForPicker(input).map((t) => t.title)).toEqual(["Alpha", "Beta", "Milo", "Zeta"]);
  });
});
