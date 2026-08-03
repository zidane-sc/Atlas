import type { ImportPayload, ValidationError, ImportValidationResult } from "@/lib/types/import-types";

// Re-export for convenience
const validTaskStatuses = new Set(["inbox", "todo", "ready", "in_progress", "blocked", "waiting_external", "testing", "done"]);
const validTaskTypes = new Set(["coding", "design", "documentation", "testing", "devops", "other"]);
const validTaskPriorities = new Set(["p0", "p1", "p2", "p3"]);
const validTaskEfforts = new Set(["xs", "s", "m", "l", "xl", "xxl"]);
const validProjectStatuses = new Set(["active", "archived", "paused"]);
const validSprintStatuses = new Set(["planning", "active", "completed", "cancelled"]);

function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date format: "${dateStr}". Expected ISO 8601 format.`);
  }
  return date;
}

export function validateImportPayload(payload: ImportPayload): ImportValidationResult {
  const errors: ValidationError[] = [];

  // Validate tasks
  (payload.tasks || []).forEach((task, idx) => {
    if (typeof task.status !== "string" || !validTaskStatuses.has(task.status)) {
      errors.push({
        category: "Task",
        index: idx,
        itemName: task.title || null,
        message: `Invalid task status: "${task.status}". Must be one of: ${Array.from(validTaskStatuses).join(", ")}`,
      });
    }
    if (typeof task.type !== "string" || !validTaskTypes.has(task.type)) {
      errors.push({
        category: "Task",
        index: idx,
        itemName: task.title || null,
        message: `Invalid task type: "${task.type}". Must be one of: ${Array.from(validTaskTypes).join(", ")}`,
      });
    }
    if (typeof task.priority !== "string" || !validTaskPriorities.has(task.priority)) {
      errors.push({
        category: "Task",
        index: idx,
        itemName: task.title || null,
        message: `Invalid task priority: "${task.priority}". Must be one of: ${Array.from(validTaskPriorities).join(", ")}`,
      });
    }
    if (task.effort !== null && task.effort !== undefined) {
      if (typeof task.effort !== "string" || !validTaskEfforts.has(task.effort)) {
        errors.push({
          category: "Task",
          index: idx,
          itemName: task.title || null,
          message: `Invalid task effort: "${task.effort}". Must be one of: ${Array.from(validTaskEfforts).join(", ")}`,
        });
      }
    }
    if (task.dueDate) {
      try {
        parseDate(task.dueDate);
      } catch (e) {
        errors.push({
          category: "Task",
          index: idx,
          itemName: task.title || null,
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }
  });

  // Validate projects
  (payload.projects || []).forEach((proj, idx) => {
    if (typeof proj.status !== "string" || !validProjectStatuses.has(proj.status)) {
      errors.push({
        category: "Project",
        index: idx,
        itemName: proj.name || null,
        message: `Invalid project status: "${proj.status}". Must be one of: ${Array.from(validProjectStatuses).join(", ")}`,
      });
    }
  });

  // Validate sprints
  (payload.sprints || []).forEach((sprint, idx) => {
    if (typeof sprint.status !== "string" || !validSprintStatuses.has(sprint.status)) {
      errors.push({
        category: "Sprint",
        index: idx,
        itemName: sprint.name || null,
        message: `Invalid sprint status: "${sprint.status}". Must be one of: ${Array.from(validSprintStatuses).join(", ")}`,
      });
    }
    try {
      parseDate(sprint.startDate);
    } catch (e) {
      errors.push({
        category: "Sprint",
        index: idx,
        itemName: sprint.name || null,
        message: `Invalid start date: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
    try {
      parseDate(sprint.endDate);
    } catch (e) {
      errors.push({
        category: "Sprint",
        index: idx,
        itemName: sprint.name || null,
        message: `Invalid end date: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  });

  // Validate bonus (if present)
  if (payload.bonus) {
    if (typeof payload.bonus.xp !== "number") {
      errors.push({
        category: "Bonus",
        index: 0,
        itemName: null,
        message: `Invalid bonus.xp: expected number, got ${typeof payload.bonus.xp}`,
      });
    }
    if (typeof payload.bonus.coins !== "number") {
      errors.push({
        category: "Bonus",
        index: 0,
        itemName: null,
        message: `Invalid bonus.coins: expected number, got ${typeof payload.bonus.coins}`,
      });
    }
  }

  return {
    counts: {
      tasks: payload.tasks?.length ?? 0,
      projects: payload.projects?.length ?? 0,
      sprints: payload.sprints?.length ?? 0,
      notes: payload.notes?.length ?? 0,
      workSessions: payload.workSessions?.length ?? 0,
      activityLogs: payload.activityLogs?.length ?? 0,
    },
    errors,
  };
}
