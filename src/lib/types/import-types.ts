import type { Task } from "@/types/task";
import type { Project, Sprint } from "@/types/gamification";

export interface WorkSessionExport {
  taskId: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
}

export interface ActivityLogExport {
  taskId: string | null;
  projectId: string | null;
  sprintId?: string | null;
  action: string;
  details: unknown;
  createdAt: string;
}

export interface ImportPayload {
  tasks: Task[];
  projects: Project[];
  sprints?: Sprint[];
  bonus: { xp: number; coins: number };
  workSessions?: WorkSessionExport[];
  activityLogs?: ActivityLogExport[];
  decorations?: { purchased: string[]; placed: Record<string, string | null> };
  savedFilters?: any[];
}

export interface ValidationError {
  category: string;
  index: number;
  itemName: string | null;
  message: string;
}

export interface ImportValidationResult {
  counts: {
    tasks: number;
    projects: number;
    sprints: number;
    workSessions: number;
    activityLogs: number;
  };
  errors: ValidationError[];
}
