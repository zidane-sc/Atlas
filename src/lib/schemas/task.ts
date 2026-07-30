import { z } from "zod";
import { PRIORITY_LABEL, STATUS_LABEL, TYPE_ICON } from "@/lib/mock-data";
import type { Effort, Priority, Reporter, TaskStatus, TaskType } from "@/types/task";

/**
 * Enum values are read off the existing STATUS_LABEL/TYPE_ICON/PRIORITY_LABEL maps
 * (mock-data.ts) rather than re-listed here — one place defines them, per
 * docs/04-development.md §4.
 */
const STATUS_VALUES = Object.keys(STATUS_LABEL) as [TaskStatus, ...TaskStatus[]];
const TYPE_VALUES = Object.keys(TYPE_ICON) as [TaskType, ...TaskType[]];
const PRIORITY_VALUES = Object.keys(PRIORITY_LABEL) as [Priority, ...Priority[]];

/** No existing map to read these off, so this is now the one place they're defined — docs/01-product.md §8.10/§8.6/§8.7. */
export const RELATION_TYPES = ["blocks", "related", "duplicate", "caused_by", "generated_from"] as const;
/** Reporter options — docs/01-product.md §8.8. */
export const REPORTER_OPTIONS = ["self", "qa", "manager", "pm", "client", "lecturer", "friend", "other"] as const satisfies readonly Reporter[];
export const ATTACHMENT_TYPES = [
  "github_pr",
  "github_issue",
  "confluence",
  "figma",
  "slack",
  "discord",
  "google_docs",
  "google_drive",
  "meeting_recording",
  "website",
  "file_upload",
  "other",
] as const;
export const DELIVERABLE_TYPES = [
  "pr",
  "confluence",
  "presentation",
  "meeting_notes",
  "design",
  "video",
  "pdf",
  "research",
] as const;

/** Allowed story point values — docs/04-development.md §6. */
export const SP_OPTIONS = [0, 1, 2, 3, 5, 8, 13, 21] as const;

/** Effort scale — docs/01-product.md §8.5. */
export const EFFORT_OPTIONS = ["xs", "s", "m", "l", "xl", "xxl"] as const satisfies readonly Effort[];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const relationSchema = z.object({
  relationType: z.enum(RELATION_TYPES),
  taskId: z.string().min(1),
  title: z.string().min(1),
});

const attachmentSchema = z.object({
  type: z.enum(ATTACHMENT_TYPES),
  label: z.string().trim().min(1, "Label is required"),
  url: z.string().trim(),
});

const deliverableSchema = z.object({
  type: z.enum(DELIVERABLE_TYPES),
  label: z.string().trim().min(1, "Label is required"),
});

export const taskFormSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().optional(),
  project: z.string().trim().min(1, "Project is required"),
  status: z.enum(STATUS_VALUES),
  type: z.enum(TYPE_VALUES),
  priority: z.enum(PRIORITY_VALUES),
  effort: z.enum(EFFORT_OPTIONS).optional(),
  storyPoint: z
    .number()
    .refine((v) => (SP_OPTIONS as readonly number[]).includes(v), "Invalid story point")
    .optional(),
  dueDate: z.string().regex(DATE_RE, "Use YYYY-MM-DD").optional(),
  waitingOn: z.string().trim().optional(),
  sprint: z.string().trim().optional(),
  reporter: z.enum(REPORTER_OPTIONS).optional(),
  tags: z.array(z.string().trim().min(1)).default([]),
  relations: z.array(relationSchema).default([]),
  attachments: z.array(attachmentSchema).default([]),
  deliverables: z.array(deliverableSchema).default([]),
});

export type TaskFormValues = z.infer<typeof taskFormSchema>;
