import type { ImportPayload, ValidationError, ImportValidationResult } from "@/lib/types/import-types";

const validTaskStatuses = new Set(["backlog", "todo", "in_progress", "done", "archived", "inbox", "ready", "blocked", "waiting_external", "testing"]);
const validTaskTypes = new Set(["coding", "research", "design", "documentation", "bug", "meeting", "admin", "investigation", "study", "analysis", "deployment", "maintenance", "refactor", "incident", "communication"]);
const validTaskPriorities = new Set(["high", "medium", "low", "p0", "p1", "p2", "p3", "p4"]);
const validTaskSizes = new Set(["xs", "s", "m", "l", "xl"]);
const validProjectStatuses = new Set(["active", "completed", "archived", "paused", "on_hold"]);

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
        message: `Invalid task status: "${task.status}".`,
      });
    }
    if (typeof task.type !== "string" || !validTaskTypes.has(task.type)) {
      errors.push({
        category: "Task",
        index: idx,
        itemName: task.title || null,
        message: `Invalid task type: "${task.type}".`,
      });
    }
    if (typeof task.priority !== "string" || !validTaskPriorities.has(task.priority)) {
      errors.push({
        category: "Task",
        index: idx,
        itemName: task.title || null,
        message: `Invalid task priority: "${task.priority}".`,
      });
    }
    if (task.size !== null && task.size !== undefined) {
      if (typeof task.size !== "string" || !validTaskSizes.has(task.size.toLowerCase())) {
        errors.push({
          category: "Task",
          index: idx,
          itemName: task.title || null,
          message: `Invalid task size: "${task.size}".`,
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
        message: `Invalid project status: "${proj.status}".`,
      });
    }
  });

  // Validate sprints (optional/legacy)
  (payload.sprints || []).forEach((sprint, idx) => {
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
      workSessions: payload.workSessions?.length ?? 0,
      activityLogs: payload.activityLogs?.length ?? 0,
    },
    errors,
  };
}
