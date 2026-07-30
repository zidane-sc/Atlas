import { z } from "zod";

export const SPRINT_STATUSES = ["planning", "active", "completed"] as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const sprintFormSchema = z
  .object({
    name: z.string().trim().min(1, "Sprint name is required"),
    startDate: z.string().regex(DATE_RE, "Use YYYY-MM-DD"),
    endDate: z.string().regex(DATE_RE, "Use YYYY-MM-DD"),
    status: z.enum(SPRINT_STATUSES),
    goal: z.string().trim().optional(),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: "End date must be on or after start date",
    path: ["endDate"],
  });

export type SprintFormValues = z.infer<typeof sprintFormSchema>;
