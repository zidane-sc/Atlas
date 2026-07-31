import { z } from "zod";

export const createNoteSchema = z.object({
  title: z.string().min(1, "Title required").max(255, "Title too long"),
  content: z.string().min(1, "Content required"),
  tags: z.array(z.string()).default([]),
  taskIds: z.array(z.string().uuid()).optional(),
});

export const updateNoteSchema = z.object({
  noteId: z.string().cuid(),
  title: z.string().min(1).max(255).optional(),
  content: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
  taskIds: z.array(z.string().uuid()).optional(),
});

export const deleteNoteSchema = z.object({
  noteId: z.string().cuid(),
});

export const listNotesSchema = z.object({
  search: z.string().optional(),
  tags: z.array(z.string()).optional(),
  skip: z.number().int().min(0).default(0),
  take: z.number().int().min(1).max(100).default(20),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
export type ListNotesInput = z.infer<typeof listNotesSchema>;
