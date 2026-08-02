import { describe, expect, it } from "vitest";
import { isDueSoon, isOverdue } from "./task-utils";

describe("isOverdue", () => {
  it("is true when the due date is before today", () => {
    expect(isOverdue("2026-07-01", "2026-07-02")).toBe(true);
  });

  it("is false when the due date is today or in the future", () => {
    expect(isOverdue("2026-07-02", "2026-07-02")).toBe(false);
    expect(isOverdue("2026-07-03", "2026-07-02")).toBe(false);
  });

  it("is false when there is no due date", () => {
    expect(isOverdue(undefined, "2026-07-02")).toBe(false);
  });
});

describe("isDueSoon", () => {
  it("is true for today", () => {
    expect(isDueSoon("2026-07-02", "2026-07-02")).toBe(true);
  });

  it("is true for tomorrow", () => {
    expect(isDueSoon("2026-07-03", "2026-07-02")).toBe(true);
  });

  it("is true across a month boundary", () => {
    expect(isDueSoon("2026-08-01", "2026-07-31")).toBe(true);
  });

  it("is false for an already-overdue task", () => {
    expect(isDueSoon("2026-07-01", "2026-07-02")).toBe(false);
  });

  it("is false more than a day out", () => {
    expect(isDueSoon("2026-07-05", "2026-07-02")).toBe(false);
  });

  it("is false when there is no due date", () => {
    expect(isDueSoon(undefined, "2026-07-02")).toBe(false);
  });
});
