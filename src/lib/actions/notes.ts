"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ActionResult } from "@/lib/actions/types";
import type { Note, NoteWithMeta, Attachment, NotePreview } from "@/types/note";
import {
  createNoteSchema,
  updateNoteSchema,
  deleteNoteSchema,
  listNotesSchema,
  type CreateNoteInput,
  type UpdateNoteInput,
  type ListNotesInput,
} from "@/lib/schemas/note";

export async function createNoteAction(input: unknown): Promise<ActionResult<Note>> {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
  }

  const parsed = createNoteSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid input." },
    };
  }

  try {
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return { success: false, error: { code: "NOT_FOUND", message: "User not found." } };
    }

    const note = await db.note.create({
      data: {
        userId: user.id,
        title: parsed.data.title,
        content: parsed.data.content,
        tags: parsed.data.tags || [],
      },
    });

    if (parsed.data.taskIds?.length) {
      await db.noteTaskLink.createMany({
        data: parsed.data.taskIds.map((taskId) => ({
          noteId: note.id,
          taskId,
        })),
      });
    }

    return {
      success: true,
      data: {
        id: note.id,
        userId: note.userId,
        title: note.title,
        content: note.content,
        tags: note.tags,
        pinned: note.pinned,
        createdAt: note.createdAt.toISOString(),
        updatedAt: note.updatedAt.toISOString(),
      },
    };
  } catch (error) {
    console.error("Failed to create note:", error);
    return { success: false, error: { code: "INTERNAL", message: "Failed to create note." } };
  }
}

export async function updateNoteAction(input: unknown): Promise<ActionResult<Note>> {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
  }

  const parsed = updateNoteSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid input." },
    };
  }

  try {
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return { success: false, error: { code: "NOT_FOUND", message: "User not found." } };
    }

    const existing = await db.note.findUnique({ where: { id: parsed.data.noteId }, select: { userId: true } });
    if (!existing || existing.userId !== user.id) {
      return { success: false, error: { code: "UNAUTHORIZED", message: "Not authorized." } };
    }

    if (parsed.data.taskIds !== undefined) {
      await db.noteTaskLink.deleteMany({ where: { noteId: parsed.data.noteId } });
      if (parsed.data.taskIds.length > 0) {
        await db.noteTaskLink.createMany({
          data: parsed.data.taskIds.map((taskId) => ({
            noteId: parsed.data.noteId,
            taskId,
          })),
        });
      }
    }

    const note = await db.note.update({
      where: { id: parsed.data.noteId },
      data: {
        ...(parsed.data.title !== undefined && { title: parsed.data.title }),
        ...(parsed.data.content !== undefined && { content: parsed.data.content }),
        ...(parsed.data.tags !== undefined && { tags: parsed.data.tags }),
      },
    });

    return {
      success: true,
      data: {
        id: note.id,
        userId: note.userId,
        title: note.title,
        content: note.content,
        tags: note.tags,
        pinned: note.pinned,
        createdAt: note.createdAt.toISOString(),
        updatedAt: note.updatedAt.toISOString(),
      },
    };
  } catch (error) {
    console.error("Failed to update note:", error);
    return { success: false, error: { code: "INTERNAL", message: "Failed to update note." } };
  }
}

export async function deleteNoteAction(noteId: string): Promise<ActionResult<void>> {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
  }

  try {
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return { success: false, error: { code: "NOT_FOUND", message: "User not found." } };
    }

    const note = await db.note.findUnique({ where: { id: noteId }, select: { userId: true } });
    if (!note || note.userId !== user.id) {
      return { success: false, error: { code: "UNAUTHORIZED", message: "Not authorized." } };
    }

    await db.note.delete({ where: { id: noteId } });

    return { success: true, data: undefined };
  } catch (error) {
    console.error("Failed to delete note:", error);
    return { success: false, error: { code: "INTERNAL", message: "Failed to delete note." } };
  }
}

export async function getNoteAction(noteId: string): Promise<ActionResult<NoteWithMeta>> {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
  }

  try {
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return { success: false, error: { code: "NOT_FOUND", message: "User not found." } };
    }

    const note = await db.note.findUnique({
      where: { id: noteId },
      include: {
        attachments: true,
        taskLinks: {
          select: {
            task: { select: { id: true, title: true } },
          },
        },
      },
    });

    if (!note || note.userId !== user.id) {
      return { success: false, error: { code: "UNAUTHORIZED", message: "Not authorized." } };
    }

    return {
      success: true,
      data: {
        note: {
          id: note.id,
          userId: note.userId,
          title: note.title,
          content: note.content,
          tags: note.tags,
          pinned: note.pinned,
          createdAt: note.createdAt.toISOString(),
          updatedAt: note.updatedAt.toISOString(),
        },
        attachments: note.attachments.map((a) => ({
          id: a.id,
          noteId: a.noteId,
          url: a.url,
          fileName: a.fileName,
          fileType: a.fileType ?? undefined,
          createdAt: a.createdAt.toISOString(),
        })),
        linkedTasks: note.taskLinks.map((link) => ({
          id: link.task.id,
          title: link.task.title,
        })),
      },
    };
  } catch (error) {
    console.error("Failed to fetch note:", error);
    return { success: false, error: { code: "INTERNAL", message: "Failed to fetch note." } };
  }
}

export async function listNotesAction(
  input: unknown
): Promise<ActionResult<{ notes: NotePreview[]; total: number }>> {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
  }

  const parsed = listNotesSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid input." },
    };
  }

  try {
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return { success: false, error: { code: "NOT_FOUND", message: "User not found." } };
    }

    const where: any = { userId: user.id };

    if (parsed.data.search) {
      where.OR = [
        { title: { contains: parsed.data.search, mode: "insensitive" } },
        { content: { contains: parsed.data.search, mode: "insensitive" } },
      ];
    }

    if (parsed.data.tags?.length) {
      where.AND = parsed.data.tags.map((tag) => ({
        tags: { has: tag },
      }));
    }

    const [notes, total] = await Promise.all([
      db.note.findMany({
        where,
        select: {
          id: true,
          title: true,
          content: true,
          tags: true,
          pinned: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { taskLinks: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: parsed.data.skip,
        take: parsed.data.take,
      }),
      db.note.count({ where }),
    ]);

    const previews: NotePreview[] = notes.map((note) => ({
      id: note.id,
      title: note.title,
      preview: note.content.length > 50 ? note.content.slice(0, 50) + "..." : note.content,
      tags: note.tags,
      pinned: note.pinned,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
      linkedTaskCount: note._count.taskLinks,
    }));

    return {
      success: true,
      data: { notes: previews, total },
    };
  } catch (error) {
    console.error("Failed to list notes:", error);
    return { success: false, error: { code: "INTERNAL", message: "Failed to fetch notes." } };
  }
}

export async function getTaskNotesAction(taskId: string): Promise<ActionResult<{ notes: NotePreview[] }>> {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
  }

  try {
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return { success: false, error: { code: "NOT_FOUND", message: "User not found." } };
    }

    const links = await db.noteTaskLink.findMany({
      where: { taskId },
      select: {
        note: {
          select: {
            id: true,
            title: true,
            content: true,
            tags: true,
            pinned: true,
            createdAt: true,
            updatedAt: true,
            userId: true,
            _count: { select: { taskLinks: true } },
          },
        },
      },
    });

    const previews: NotePreview[] = links
      .filter((link) => link.note.userId === user.id)
      .map((link) => ({
        id: link.note.id,
        title: link.note.title,
        preview: link.note.content.length > 30 ? link.note.content.slice(0, 30) + "..." : link.note.content,
        tags: link.note.tags,
        pinned: link.note.pinned,
        createdAt: link.note.createdAt.toISOString(),
        updatedAt: link.note.updatedAt.toISOString(),
        linkedTaskCount: link.note._count.taskLinks,
      }));

    return {
      success: true,
      data: { notes: previews },
    };
  } catch (error) {
    console.error("Failed to fetch task notes:", error);
    return { success: false, error: { code: "INTERNAL", message: "Failed to fetch task notes." } };
  }
}

export async function uploadNoteAttachmentAction(
  noteId: string,
  fileName: string,
  fileUrl: string
): Promise<ActionResult<Attachment>> {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
  }

  try {
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return { success: false, error: { code: "NOT_FOUND", message: "User not found." } };
    }

    const note = await db.note.findUnique({
      where: { id: noteId },
      select: { userId: true },
    });

    if (!note || note.userId !== user.id) {
      return { success: false, error: { code: "UNAUTHORIZED", message: "Not authorized." } };
    }

    const attachment = await db.noteAttachment.create({
      data: {
        noteId,
        url: fileUrl,
        fileName,
        fileType: fileName.split(".").pop() || "file",
      },
    });

    return {
      success: true,
      data: {
        id: attachment.id,
        noteId: attachment.noteId,
        url: attachment.url,
        fileName: attachment.fileName,
        fileType: attachment.fileType ?? undefined,
        createdAt: attachment.createdAt.toISOString(),
      },
    };
  } catch (error) {
    console.error("Failed to upload attachment:", error);
    return { success: false, error: { code: "INTERNAL", message: "Failed to upload attachment." } };
  }
}
