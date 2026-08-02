import { describe, expect, it } from "vitest";
import {
  calcTaskCoins,
  calcTaskXP,
  completedAt,
  computeAchievementProgress,
  computeCharacterSheet,
  computeRecapGrade,
  getCompanionMood,
  getFarewell,
  getLevelInfo,
  xpForLevel,
  calculateStreak,
  calculateLongestStreak,
  checkAndEmitDueDateNotifications,
} from "./gamification";
import { notificationEmitter } from "@/hooks/useNotifications";
import type { NotificationEvent } from "@/lib/notification-events";
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

describe("calculateLongestStreak", () => {
  it("returns 0 if no tasks are done", () => {
    expect(calculateLongestStreak([])).toBe(0);
  });

  it("finds the longest historical run, not just the most recent one", () => {
    const at = (d: string) => [{ fromStatus: "todo" as const, toStatus: "done" as const, changedAt: `${d}T10:00:00Z` }];
    const list = [
      // a 3-day run in the past...
      task({ id: "1", priority: "p2", type: "coding", status: "done", statusHistory: at("2026-07-01") }),
      task({ id: "2", priority: "p2", type: "coding", status: "done", statusHistory: at("2026-07-02") }),
      task({ id: "3", priority: "p2", type: "coding", status: "done", statusHistory: at("2026-07-03") }),
      // ...a gap...
      // ...then only a 2-day run more recently.
      task({ id: "4", priority: "p2", type: "coding", status: "done", statusHistory: at("2026-07-10") }),
      task({ id: "5", priority: "p2", type: "coding", status: "done", statusHistory: at("2026-07-11") }),
    ];
    expect(calculateLongestStreak(list)).toBe(3);
  });
});

describe("computeAchievementProgress — a12/a13/a14 (docs/05-backlog.md §6 fix)", () => {
  it("a12 Perfect Week is real progress toward a 7-day streak, not permanently null", () => {
    const at = (d: string) => [{ fromStatus: "todo" as const, toStatus: "done" as const, changedAt: `${d}T10:00:00Z` }];
    const sevenDays = ["01", "02", "03", "04", "05", "06", "07"].map((d, i) =>
      task({ id: `t${i}`, priority: "p2", type: "coding", status: "done", statusHistory: at(`2026-07-${d}`) })
    );
    expect(computeAchievementProgress("a12", sevenDays, [], [])).toEqual({ current: 7, max: 7 });
    expect(computeAchievementProgress("a12", [], [], [])).toEqual({ current: 0, max: 7 });
  });

  it("a13/a14 add the 500/1000 quest tiers alongside a6's 100", () => {
    const done = Array.from({ length: 3 }, (_, i) =>
      task({ id: `t${i}`, priority: "p2", type: "coding", status: "done" })
    );
    expect(computeAchievementProgress("a13", done, [], [])).toEqual({ current: 3, max: 500 });
    expect(computeAchievementProgress("a14", done, [], [])).toEqual({ current: 3, max: 1000 });
  });
});

describe("checkAndEmitDueDateNotifications — docs/05-backlog.md §6 (was declared, never emitted)", () => {
  function capture(fn: () => void): NotificationEvent[] {
    const events: NotificationEvent[] = [];
    const unsubscribe = notificationEmitter.subscribe((e) => events.push(e));
    fn();
    unsubscribe();
    return events;
  }

  it("emits nothing when nothing is overdue or due soon", () => {
    const tasks = [task({ id: "1", priority: "p2", type: "coding", status: "todo", dueDate: "2026-07-10" })];
    const events = capture(() => checkAndEmitDueDateNotifications(tasks, "2026-07-02"));
    expect(events).toEqual([]);
  });

  it("emits task:overdue for the most overdue active task, ignoring done tasks", () => {
    const tasks = [
      task({ id: "1", priority: "p2", type: "coding", status: "todo", title: "Oldest", dueDate: "2026-06-01" }),
      task({ id: "2", priority: "p2", type: "coding", status: "in_progress", title: "Newer", dueDate: "2026-06-15" }),
      task({ id: "3", priority: "p2", type: "coding", status: "done", title: "Finished late", dueDate: "2026-06-01" }),
    ];
    const events = capture(() => checkAndEmitDueDateNotifications(tasks, "2026-07-02"));
    const overdue = events.find((e) => e.type === "task:overdue");
    expect(overdue).toMatchObject({ taskId: "1", title: "Oldest (+1 more overdue)" });
  });

  it("emits task:due-soon for a task due today or tomorrow", () => {
    const tasks = [task({ id: "1", priority: "p2", type: "coding", status: "ready", title: "Almost due", dueDate: "2026-07-03" })];
    const events = capture(() => checkAndEmitDueDateNotifications(tasks, "2026-07-02"));
    const dueSoon = events.find((e) => e.type === "task:due-soon");
    expect(dueSoon).toMatchObject({ taskId: "1", title: "Almost due", dueDate: "2026-07-03" });
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

describe("getFarewell — save & quit", () => {
  it("stays neutral when nothing was completed today", () => {
    expect(getFarewell(0, 0)).toEqual({
      line: "The realm will keep. See you tomorrow.",
      mood: "sad",
    });
  });

  it("celebrates a strong streak when quests were done today", () => {
    expect(getFarewell(3, 7)).toEqual({
      line: "Legendary work, hero. The flame endures.",
      mood: "happy",
    });
  });

  it("acknowledges a growing streak", () => {
    expect(getFarewell(2, 3)).toEqual({
      line: "Nice quests today. The fire grows.",
      mood: "idle",
    });
  });

  it("cheers any completed quest even with no streak", () => {
    expect(getFarewell(1, 0)).toEqual({
      line: "Every quest counts. Good session.",
      mood: "idle",
    });
  });
});
