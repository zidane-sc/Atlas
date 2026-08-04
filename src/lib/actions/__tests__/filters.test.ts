import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateFilterAction, type SavedFilterClient } from "@/lib/actions/filters";
import { EMPTY_TASK_FILTERS } from "@/lib/task-filters";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockFindUnique = db.user.findUnique as unknown as ReturnType<typeof vi.fn>;
const mockUpdate = db.user.update as unknown as ReturnType<typeof vi.fn>;

function existingFilters(): SavedFilterClient[] {
  return [
    { id: "view-1", name: "My Bugs", filters: { ...EMPTY_TASK_FILTERS, types: ["bug"] } },
    { id: "view-2", name: "Sprint Work", filters: { ...EMPTY_TASK_FILTERS, tags: ["sprint"] } },
  ];
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { email: "dev@example.com" } });
});

describe("updateFilterAction", () => {
  it("renames a view, preserving its filters", async () => {
    mockFindUnique.mockResolvedValue({ id: "user-1", savedFilters: existingFilters() });
    mockUpdate.mockResolvedValue({});

    const result = await updateFilterAction("view-1", "Renamed", existingFilters()[0].filters);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    const updated = result.data.find((f) => f.id === "view-1");
    expect(updated?.name).toBe("Renamed");
    expect(updated?.filters).toEqual(existingFilters()[0].filters);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { savedFilters: expect.any(Array) },
    });
  });

  it("updates filters, preserving id and name", async () => {
    mockFindUnique.mockResolvedValue({ id: "user-1", savedFilters: existingFilters() });
    mockUpdate.mockResolvedValue({});

    const newFilters = { ...EMPTY_TASK_FILTERS, priorities: ["p0" as const] };
    const result = await updateFilterAction("view-1", "My Bugs", newFilters);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    const updated = result.data.find((f) => f.id === "view-1");
    expect(updated?.id).toBe("view-1");
    expect(updated?.name).toBe("My Bugs");
    expect(updated?.filters).toEqual(newFilters);
  });

  it("rejects when the new name collides with a different view", async () => {
    mockFindUnique.mockResolvedValue({ id: "user-1", savedFilters: existingFilters() });

    const result = await updateFilterAction("view-1", "Sprint Work", existingFilters()[0].filters);

    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.error.code).toBe("CONFLICT");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("allows saving with the view's own unchanged name", async () => {
    mockFindUnique.mockResolvedValue({ id: "user-1", savedFilters: existingFilters() });
    mockUpdate.mockResolvedValue({});

    const result = await updateFilterAction("view-1", "My Bugs", existingFilters()[0].filters);

    expect(result.success).toBe(true);
  });

  it("returns NOT_FOUND when the id doesn't match any saved view", async () => {
    mockFindUnique.mockResolvedValue({ id: "user-1", savedFilters: existingFilters() });

    const result = await updateFilterAction("missing-id", "Whatever", EMPTY_TASK_FILTERS);

    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.error.code).toBe("NOT_FOUND");
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
