import { z } from "zod";

export const PROJECT_CATEGORIES = ["Full-time", "University", "Side Project", "Freelance", "Personal", "Other"] as const;

/** Swatch options for the New Project panel — colorVar points at an existing palette token. */
export const PROJECT_COLOR_OPTIONS = [
  { label: "Red", colorVar: "--color-priority-p0" },
  { label: "Violet", colorVar: "--color-status-waiting-external" },
  { label: "Teal", colorVar: "--color-status-ready" },
  { label: "Yellow", colorVar: "--color-status-in-progress" },
  { label: "Cyan", colorVar: "--color-status-testing" },
  { label: "Muted", colorVar: "--color-text-muted" },
] as const;

export const PROJECT_STATUSES = ["active", "on_hold", "completed"] as const;

export const projectFormSchema = z.object({
  name: z.string().trim().min(1, "Project name is required"),
  emoji: z.string().trim().min(1).max(4),
  category: z.enum(PROJECT_CATEGORIES),
  colorVar: z.string().min(1),
  description: z.string().trim().optional(),
  status: z.enum(PROJECT_STATUSES),
});

export type ProjectFormValues = z.infer<typeof projectFormSchema>;

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Project name is required"),
  emoji: z.string().trim().min(1).max(4),
  category: z.enum(PROJECT_CATEGORIES),
  colorVar: z.string().min(1),
  description: z.string().trim().optional(),
  status: z.enum(PROJECT_STATUSES).default("active"),
});

export type CreateProjectInput = z.input<typeof createProjectSchema>;

export const updateProjectSchema = z.object({
  name: z.string().trim().min(1, "Project name is required").optional(),
  emoji: z.string().trim().min(1).max(4).optional(),
  category: z.enum(PROJECT_CATEGORIES).optional(),
  colorVar: z.string().min(1).optional(),
  description: z.string().trim().nullable().optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
});

import { ProjectCategory } from "@/generated/prisma/client";

export type UpdateProjectInput = z.input<typeof updateProjectSchema>;

export function toDbProjectCategory(cat: string): ProjectCategory {
  if (cat === "Full-time") return "FullTime";
  if (cat === "Side Project") return "SideProject";
  return cat as ProjectCategory;
}


