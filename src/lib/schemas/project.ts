import { z } from "zod";
import type { ProjectCategory, ProjectStatus } from "@/generated/prisma/client";

export const PROJECT_CATEGORIES = ["Work", "Personal", "Learning", "Other"] as const;

export const PROJECT_COLOR_OPTIONS = [
  { label: "Red", colorVar: "--color-priority-p0" },
  { label: "Violet", colorVar: "--color-status-waiting-external" },
  { label: "Teal", colorVar: "--color-status-ready" },
  { label: "Yellow", colorVar: "--color-status-in-progress" },
  { label: "Cyan", colorVar: "--color-status-testing" },
  { label: "Muted", colorVar: "--color-text-muted" },
] as const;

export const PROJECT_STATUSES = ["active", "completed", "archived"] as const;

export const projectFormSchema = z.object({
  name: z.string().trim().min(1, "Project name is required"),
  code: z.string().trim().toUpperCase().min(2).max(4, "Code must be 2-4 chars").regex(/^[A-Z0-9]+$/, "Code must be uppercase letters/numbers only").optional(),
  emoji: z.string().trim().min(1).max(4),
  category: z.enum(PROJECT_CATEGORIES),
  colorVar: z.string().min(1),
  customColor: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid color format").optional(),
  description: z.string().trim().optional(),
  status: z.enum(PROJECT_STATUSES),
});

export type ProjectFormValues = z.infer<typeof projectFormSchema>;

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Project name is required"),
  code: z.string().trim().toUpperCase().min(2).max(4, "Code must be 2-4 chars").regex(/^[A-Z0-9]+$/, "Code must be uppercase letters/numbers only").optional(),
  emoji: z.string().trim().min(1).max(4),
  category: z.enum(PROJECT_CATEGORIES),
  colorVar: z.string().min(1),
  customColor: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid color format").optional(),
  description: z.string().trim().optional(),
  status: z.enum(PROJECT_STATUSES).default("active"),
});

export type CreateProjectInput = z.input<typeof createProjectSchema>;

export const updateProjectSchema = z.object({
  name: z.string().trim().min(1, "Project name is required").optional(),
  code: z.string().trim().toUpperCase().min(2).max(4, "Code must be 2-4 chars").regex(/^[A-Z0-9]+$/, "Code must be uppercase letters/numbers only").nullable().optional(),
  emoji: z.string().trim().min(1).max(4).optional(),
  category: z.enum(PROJECT_CATEGORIES).optional(),
  colorVar: z.string().min(1).optional(),
  customColor: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid color format").nullable().optional(),
  description: z.string().trim().nullable().optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
});

export type UpdateProjectInput = z.input<typeof updateProjectSchema>;

export function toDbProjectCategory(cat: string): ProjectCategory {
  const lower = cat.toLowerCase();
  if (lower === "work") return "work" as ProjectCategory;
  if (lower === "personal") return "personal" as ProjectCategory;
  if (lower === "learning") return "learning" as ProjectCategory;
  return "other" as ProjectCategory;
}

export function fromDbProjectCategory(cat: string): (typeof PROJECT_CATEGORIES)[number] {
  const lower = cat.toLowerCase();
  if (lower === "work") return "Work";
  if (lower === "personal") return "Personal";
  if (lower === "learning") return "Learning";
  return "Other";
}
