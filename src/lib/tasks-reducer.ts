import type { Task } from "@/types/task";
import type { TaskFormValues } from "@/lib/schemas/task";

export type TasksAction =
  | { type: "create"; id: string; changedAt: string; values: TaskFormValues }
  | { type: "update"; id: string; changedAt: string; values: TaskFormValues }
  | { type: "delete"; id: string }
  | { type: "addTime"; id: string; seconds: number }
  | { type: "reset"; tasks: Task[] };

/** Builds a fresh Task from form values — shared by `create` and by duplicateTask in TasksProvider. */
export function buildTaskFromValues(id: string, changedAt: string, values: TaskFormValues): Task {
  return {
    id,
    title: values.title,
    description: values.description,
    project: values.project,
    status: values.status,
    type: values.type,
    priority: values.priority,
    effort: values.effort,
    storyPoint: values.storyPoint,
    dueDate: values.dueDate,
    waitingOn: values.waitingOn,
    sprint: values.sprint,
    reporter: values.reporter,
    tags: values.tags,
    relations: values.relations,
    attachments: values.attachments,
    deliverables: values.deliverables,
    statusHistory: [{ fromStatus: null, toStatus: values.status, changedAt }],
  };
}

/**
 * Pure reducer for the client-side task store — no backend yet (docs/02-architecture.md
 * §4 has no `schema.prisma` in place), so this stands in for the eventual `createTask`/
 * `updateTask`/`deleteTask` Server Actions. A status change always appends a statusHistory
 * row, the client-side equivalent of the `task_status_logs` write in docs/04-development.md §3.
 */
export function tasksReducer(tasks: Task[], action: TasksAction): Task[] {
  switch (action.type) {
    case "create": {
      return [buildTaskFromValues(action.id, action.changedAt, action.values), ...tasks];
    }
    case "update": {
      return tasks.map((t) => {
        if (t.id !== action.id) return t;
        const statusChanged = t.status !== action.values.status;
        return {
          ...t,
          title: action.values.title,
          description: action.values.description,
          project: action.values.project,
          status: action.values.status,
          type: action.values.type,
          priority: action.values.priority,
          effort: action.values.effort,
          storyPoint: action.values.storyPoint,
          dueDate: action.values.dueDate,
          waitingOn: action.values.waitingOn,
          sprint: action.values.sprint,
          reporter: action.values.reporter,
          tags: action.values.tags,
          relations: action.values.relations,
          attachments: action.values.attachments,
          deliverables: action.values.deliverables,
          statusHistory: statusChanged
            ? [...t.statusHistory, { fromStatus: t.status, toStatus: action.values.status, changedAt: action.changedAt }]
            : t.statusHistory,
        };
      });
    }
    case "delete": {
      return tasks.filter((t) => t.id !== action.id);
    }
    case "addTime": {
      return tasks.map((t) => (t.id === action.id ? { ...t, timeSpentSeconds: (t.timeSpentSeconds ?? 0) + action.seconds } : t));
    }
    case "reset": {
      return action.tasks;
    }
    default:
      return tasks;
  }
}
