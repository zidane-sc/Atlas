import { describe, expect, it } from "vitest";
import {
  calcTaskCoins,
  calcTaskXP,
  completedAt,
  computeCharacterSheet,
  computeRecapGrade,
  getCompanionMood,
  getLevelInfo,
  xpForLevel,
  calculateStreak,
} from "./gamification";
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

describe("xpForLevel / getLevelInfo — docs/03-design.md §11.4", () => {
  it("matches the documented level-curve table", () => {
    expect(xpForLevel(1)).toBe(100);
    expect(xpForLevel(2)).toBe(280);
    expect(xpForLevel(3)).toBe(520);
    expect(xpForLevel(10)).toBe(3160);
  });

  it("resolves level/currentXP/nextLevelXP from cumulative XP", () => {
    expect(getLevelInfo(0)).toEqual({ level: 1, currentXP: 0, nextLevelXP: 100 });
    expect(getLevelInfo(99)).toEqual({ level: 1, currentXP: 99, nextLevelXP: 100 });
    // 100 cumulative XP exactly clears level 1 (need > cumulative, not >=)
    expect(getLevelInfo(100)).toEqual({ level: 2, currentXP: 0, nextLevelXP: 280 });
    expect(getLevelInfo(380)).toEqual({ level: 3, currentXP: 0, nextLevelXP: 520 });
  });
});

describe("calcTaskXP / calcTaskCoins — docs/03-design.md §11.1, §11.5", () => {
  it("applies the 1.2x on-time multiplier", () => {
    expect(calcTaskXP("p0", 0, true)).toBe(Math.round(100 * 1.2));
    expect(calcTaskXP("p0", 0, false)).toBe(100);
  });

  it("adds story points at 10 XP each before the multiplier", () => {
    expect(calcTaskXP("p2", 5, true)).toBe(Math.round((30 + 50) * 1.2));
  });

  it("defaults missing story points to 0", () => {
    expect(calcTaskXP("p1", undefined, true)).toBe(Math.round(60 * 1.2));
  });

  it("sums story points with the priority coin bonus", () => {
    expect(calcTaskCoins("p0", 3)).toBe(8);
    expect(calcTaskCoins("p4", undefined)).toBe(0);
  });
});

describe("computeCharacterSheet — docs/03-design.md §11.8", () => {
  it("caps every stat at 20", () => {
    // Ten p0-storyPoint-21 coding tasks done — enough to blow well past a level that
    // would push INT above 20 if the cap were missing.
    const tasks: Task[] = Array.from({ length: 10 }, (_, i) =>
      task({
        id: `t${i}`,
        priority: "p0",
        type: "coding",
        status: "done",
        storyPoint: 21,
        statusHistory: [{ fromStatus: "in_progress", toStatus: "done", changedAt: "2026-01-01T00:00:00Z" }],
      })
    );
    const sheet = computeCharacterSheet(tasks);
    expect(sheet.statScore.INT).toBeLessThanOrEqual(20);
  });

  it("defaults to Apprentice with no completed tasks", () => {
    const sheet = computeCharacterSheet([]);
    expect(sheet.classTitle).toBe("Apprentice");
    expect(sheet.completedCount).toBe(0);
  });

  it("picks the class title from the highest-XP skill once it clears level 1", () => {
    const tasks: Task[] = [
      task({
        id: "t1",
        priority: "p0",
        type: "bug",
        status: "done",
        storyPoint: 8,
        statusHistory: [{ fromStatus: "in_progress", toStatus: "done", changedAt: "2026-01-01T00:00:00Z" }],
      }),
      task({
        id: "t2",
        priority: "p4",
        type: "documentation",
        status: "done",
        statusHistory: [{ fromStatus: "in_progress", toStatus: "done", changedAt: "2026-01-01T00:00:00Z" }],
      }),
    ];
    const sheet = computeCharacterSheet(tasks);
    expect(sheet.classTitle).toBe("Bug Slayer");
  });
});

describe("computeRecapGrade — docs/03-design.md §11.10", () => {
  it("hits every grade boundary exactly", () => {
    expect(computeRecapGrade(10, 10)).toBe("S"); // velocity 1.0
    expect(computeRecapGrade(7, 10)).toBe("A"); // velocity 0.7
    expect(computeRecapGrade(45, 100)).toBe("B"); // velocity 0.45
    expect(computeRecapGrade(25, 100)).toBe("C"); // velocity 0.25
    expect(computeRecapGrade(24, 100)).toBe("D"); // just under 0.25
  });

  it("treats zero created tasks as a divide-by-zero guard, not a crash", () => {
    expect(computeRecapGrade(0, 0)).toBe("D");
  });
});

describe("getCompanionMood — docs/03-design.md §11.9", () => {
  it("overrides to excited regardless of streak", () => {
    expect(getCompanionMood(0, true)).toBe("excited");
  });

  it("steps down through happy/idle/sad as today's completed count drops", () => {
    expect(getCompanionMood(5, false)).toBe("happy");
    expect(getCompanionMood(4, false)).toBe("idle");
    expect(getCompanionMood(2, false)).toBe("idle");
    expect(getCompanionMood(1, false)).toBe("sad");
    expect(getCompanionMood(0, false)).toBe("sad");
  });
});

describe("calculateStreak", () => {
  it("returns 0 if no tasks are done", () => {
    expect(calculateStreak([])).toBe(0);
  });

  it("calculates correct streak with contiguous completions", () => {
    const list = [
      task({ id: "1", priority: "p2", type: "coding", status: "done", statusHistory: [{ fromStatus: "todo", toStatus: "done", changedAt: "2026-07-30T10:00:00Z" }] }),
      task({ id: "2", priority: "p2", type: "coding", status: "done", statusHistory: [{ fromStatus: "todo", toStatus: "done", changedAt: "2026-07-29T12:00:00Z" }] }),
      task({ id: "3", priority: "p2", type: "coding", status: "done", statusHistory: [{ fromStatus: "todo", toStatus: "done", changedAt: "2026-07-28T09:00:00Z" }] }),
    ];
    expect(calculateStreak(list, "2026-07-30T15:00:00Z")).toBe(3);
  });

  it("retains active streak if today has no completion yet but yesterday did", () => {
    const list = [
      task({ id: "2", priority: "p2", type: "coding", status: "done", statusHistory: [{ fromStatus: "todo", toStatus: "done", changedAt: "2026-07-29T12:00:00Z" }] }),
      task({ id: "3", priority: "p2", type: "coding", status: "done", statusHistory: [{ fromStatus: "todo", toStatus: "done", changedAt: "2026-07-28T09:00:00Z" }] }),
    ];
    expect(calculateStreak(list, "2026-07-30T15:00:00Z")).toBe(2);
  });

  it("returns 0 if both today and yesterday have no completions", () => {
    const list = [
      task({ id: "3", priority: "p2", type: "coding", status: "done", statusHistory: [{ fromStatus: "todo", toStatus: "done", changedAt: "2026-07-28T09:00:00Z" }] }),
    ];
    expect(calculateStreak(list, "2026-07-30T15:00:00Z")).toBe(0);
  });
});

describe("completedAt — prioritizes task.completedAt over status logs", () => {
  it("prefers the task.completedAt timestamp when both sources exist", () => {
    const t = task({
      id: "1",
      priority: "p2",
      type: "coding",
      status: "done",
      completedAt: "2026-07-29T17:00:00Z",
      statusHistory: [{ fromStatus: "in_progress", toStatus: "done", changedAt: "2026-07-30T10:00:00Z" }],
    });
    expect(completedAt(t)).toBe("2026-07-29T17:00:00Z");
  });

  it("falls back to the done status-log entry when completedAt is absent", () => {
    const t = task({
      id: "1",
      priority: "p2",
      type: "coding",
      status: "done",
      statusHistory: [{ fromStatus: "in_progress", toStatus: "done", changedAt: "2026-07-30T10:00:00Z" }],
    });
    expect(completedAt(t)).toBe("2026-07-30T10:00:00Z");
  });

  it("feeds the streak with the local date of task.completedAt, not the status log", () => {
    const list = [
      task({
        id: "1",
        priority: "p2",
        type: "coding",
        status: "done",
        completedAt: "2026-07-29T10:00:00Z",
        statusHistory: [{ fromStatus: "in_progress", toStatus: "done", changedAt: "2026-07-30T10:00:00Z" }],
      }),
      task({
        id: "2",
        priority: "p2",
        type: "coding",
        status: "done",
        statusHistory: [{ fromStatus: "todo", toStatus: "done", changedAt: "2026-07-28T10:00:00Z" }],
      }),
    ];
    expect(calculateStreak(list, "2026-07-30T12:00:00Z")).toBe(2);
  });
});
