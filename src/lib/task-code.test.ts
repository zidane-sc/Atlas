import { describe, expect, it } from "vitest";
import { generateTaskCode, getNextTaskCodeNumber } from "./task-code";

describe("generateTaskCode", () => {
  it("formats code with uppercase project and number", () => {
    expect(generateTaskCode("ats", 1)).toBe("ATS-1");
    expect(generateTaskCode("THX", 42)).toBe("THX-42");
  });

  it("handles mixed case", () => {
    expect(generateTaskCode("AtS", 5)).toBe("ATS-5");
  });
});

describe("getNextTaskCodeNumber", () => {
  it("returns 1 if no tasks exist for prefix", async () => {
    const mockDb = {
      task: {
        findFirst: async (args: any) => {
          expect(args.where.ownerId).toBe("user1");
          expect(args.where.code.startsWith).toBe("ATS-");
          return null;
        },
      },
    };
    const result = await getNextTaskCodeNumber(mockDb, "user1", "ats");
    expect(result).toBe(1);
  });

  it("returns 1 if task exists but has no sequence number at the end", async () => {
    const mockDb = {
      task: {
        findFirst: async () => ({ code: "ATS-foo" }),
      },
    };
    const result = await getNextTaskCodeNumber(mockDb, "user1", "ats");
    expect(result).toBe(1);
  });

  it("returns next sequence number based on matching prefix", async () => {
    const mockDb = {
      task: {
        findFirst: async (args: any) => {
          expect(args.where.code.startsWith).toBe("ATS-");
          return { code: "ATS-12" };
        },
      },
    };
    const result = await getNextTaskCodeNumber(mockDb, "user1", "ats");
    expect(result).toBe(13);
  });

  it("defaults prefix to TASK", async () => {
    const mockDb = {
      task: {
        findFirst: async (args: any) => {
          expect(args.where.code.startsWith).toBe("TASK-");
          return { code: "TASK-5" };
        },
      },
    };
    const result = await getNextTaskCodeNumber(mockDb, "user1");
    expect(result).toBe(6);
  });
});

