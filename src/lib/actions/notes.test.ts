import { describe, it, expect, beforeEach, vi } from "vitest";
import { createNoteAction, updateNoteAction, deleteNoteAction, listNotesAction, getTaskNotesAction } from "./notes";
import * as authModule from "@/lib/auth";
import { db } from "@/lib/db";

vi.mock("@/lib/auth");
vi.mock("@/lib/db");

describe("Note Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createNoteAction", () => {
    it("creates note with title and content", async () => {
      const mockSession = { user: { email: "test@example.com" } };
      vi.mocked(authModule.auth).mockResolvedValue(mockSession as any);
      vi.mocked(db.user.findUnique).mockResolvedValue({ id: "user-1" } as any);
      vi.mocked(db.note.create).mockResolvedValue({
        id: "note-1",
        title: "Test",
        content: "Content",
        tags: [],
        userId: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const result = await createNoteAction({
        title: "Test",
        content: "Content",
      });

      expect(result.success).toBe(true);
      expect(result.data?.title).toBe("Test");
    });

    it("returns unauthorized if not logged in", async () => {
      vi.mocked(authModule.auth).mockResolvedValue(null);

      const result = await createNoteAction({
        title: "Test",
        content: "Content",
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("UNAUTHORIZED");
    });
  });

  describe("updateNoteAction", () => {
    it("updates note fields", async () => {
      const mockSession = { user: { email: "test@example.com" } };
      vi.mocked(authModule.auth).mockResolvedValue(mockSession as any);
      vi.mocked(db.user.findUnique).mockResolvedValue({ id: "user-1" } as any);
      vi.mocked(db.note.findUnique).mockResolvedValue({ userId: "user-1" } as any);
      vi.mocked(db.note.update).mockResolvedValue({
        id: "note-1",
        title: "Updated",
        content: "Updated Content",
        tags: ["tag1"],
        userId: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const result = await updateNoteAction({
        noteId: "note-1",
        title: "Updated",
        content: "Updated Content",
      });

      expect(result.success).toBe(true);
      expect(result.data?.title).toBe("Updated");
    });
  });

  describe("deleteNoteAction", () => {
    it("deletes note", async () => {
      const mockSession = { user: { email: "test@example.com" } };
      vi.mocked(authModule.auth).mockResolvedValue(mockSession as any);
      vi.mocked(db.user.findUnique).mockResolvedValue({ id: "user-1" } as any);
      vi.mocked(db.note.findUnique).mockResolvedValue({ userId: "user-1" } as any);
      vi.mocked(db.note.delete).mockResolvedValue({ id: "note-1" } as any);

      const result = await deleteNoteAction("note-1");

      expect(result.success).toBe(true);
    });
  });

  describe("listNotesAction", () => {
    it("returns notes list with pagination", async () => {
      const mockSession = { user: { email: "test@example.com" } };
      vi.mocked(authModule.auth).mockResolvedValue(mockSession as any);
      vi.mocked(db.user.findUnique).mockResolvedValue({ id: "user-1" } as any);
      vi.mocked(db.note.findMany).mockResolvedValue([
        {
          id: "note-1",
          title: "Test 1",
          content: "Content 1",
          tags: ["tag1"],
          createdAt: new Date(),
          _count: { taskLinks: 1 },
        },
      ] as any);
      vi.mocked(db.note.count).mockResolvedValue(1);

      const result = await listNotesAction({
        skip: 0,
        take: 20,
      });

      expect(result.success).toBe(true);
      expect(result.data?.notes).toHaveLength(1);
    });
  });

  describe("getTaskNotesAction", () => {
    it("returns notes linked to task", async () => {
      const mockSession = { user: { email: "test@example.com" } };
      vi.mocked(authModule.auth).mockResolvedValue(mockSession as any);
      vi.mocked(db.user.findUnique).mockResolvedValue({ id: "user-1" } as any);
      vi.mocked(db.noteTaskLink.findMany).mockResolvedValue([
        {
          note: {
            id: "note-1",
            title: "Research",
            content: "Some findings",
            tags: [],
            userId: "user-1",
            createdAt: new Date(),
            _count: { taskLinks: 1 },
          },
        },
      ] as any);

      const result = await getTaskNotesAction("task-1");

      expect(result.success).toBe(true);
      expect(result.data?.notes).toHaveLength(1);
    });
  });
});
