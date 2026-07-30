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
