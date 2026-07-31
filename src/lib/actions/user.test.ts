import { describe, it, expect, beforeEach, vi } from "vitest";
import { updateDrawerLastSelectedAction } from "./user";
import { auth } from "@/lib/auth";

vi.mock("@/lib/auth");
vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe("updateDrawerLastSelectedAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should persist last-selected item for task picker", async () => {
    const mockSession = { user: { email: "test@example.com" } };
    vi.mocked(auth).mockResolvedValue(mockSession as any);

    const mockUser = {
      email: "test@example.com",
      settings: [],
    };
    const { db } = await import("@/lib/db");
    vi.mocked(db.user.findUnique).mockResolvedValue(mockUser as any);

    const updated = {
      ...mockUser,
      settings: [
        { key: "drawerLastSelected", value: { task: "task-123", sprint: null, project: null } },
      ],
    };
    vi.mocked(db.user.update).mockResolvedValue(updated as any);

    const result = await updateDrawerLastSelectedAction("task", "task-123");

    expect(result.success).toBe(true);
    expect(result.data?.drawerLastSelected.task).toBe("task-123");
  });

  it("should reject without authentication", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const result = await updateDrawerLastSelectedAction("task", "task-123");
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("UNAUTHORIZED");
  });

  it("should reject invalid pickerType", async () => {
    const mockSession = { user: { email: "test@example.com" } };
    vi.mocked(auth).mockResolvedValue(mockSession as any);

    const result = await updateDrawerLastSelectedAction("invalid" as any, "task-123");
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("VALIDATION_ERROR");
  });
});
