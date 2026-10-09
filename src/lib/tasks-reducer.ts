import type { Task, TaskStatus, TaskType, Priority, Effort, Reporter, TaskAttachment, TaskDeliverable, TaskRelation, TaskComment } from "@/types/task";
import type { TaskFormValues } from "@/lib/schemas/task";
import type { Task as DbTask, Project as DbProject, Sprint as DbSprint, TaskStatusLog, Comment as DbComment, User as DbUser } from "@/generated/prisma/client";
import type { Project, Sprint } from "@/types/gamification";
import { fromDbProjectCategory } from "@/lib/schemas/project";

export type DbTaskWithLogs = Partial<DbTask> & {
  id: string;
  title: string;
  status: DbTask["status"];
  type: DbTask["type"];
  priority: DbTask["priority"];
  createdAt: Date;
  statusHistory?: TaskStatusLog[];
  comments?: (DbComment & { author: DbUser })[];
};

export function mapDbTaskToClient(dbTask: DbTaskWithLogs, dbProjects?: DbProject[], dbSprints?: DbSprint[]): Task {
  const project = dbProjects?.find((p) => p.id === dbTask.projectId);
  const sprint = dbSprints?.find((s) => s.id === dbTask.sprintId);
  return {
    id: dbTask.id,
    code: dbTask.code || `TEMP-${dbTask.id.slice(0, 8)}`,
    title: dbTask.title,
    description: dbTask.description ?? undefined,
    project: project ? project.name : "Atlas",
    status: dbTask.status as TaskStatus,
    type: dbTask.type as TaskType,
    priority: dbTask.priority as Priority,
    effort: (dbTask.effort ?? undefined) as Effort | undefined,
    storyPoint: dbTask.storyPoint ?? undefined,
    timeSpentSeconds: dbTask.timeSpentSeconds ?? 0,
    pinned: dbTask.pinned ?? false,
    startDate: dbTask.startDate ? dbTask.startDate.toISOString().split("T")[0] : undefined,
    dueDate: dbTask.dueDate ? dbTask.dueDate.toISOString().split("T")[0] : undefined,
    completedAt: dbTask.completedAt ? dbTask.completedAt.toISOString() : undefined,
    createdAt: dbTask.createdAt.toISOString(),
    sprint: sprint ? sprint.name : undefined,
    reporter: (dbTask.reporter as Reporter) || "self",
    tags: dbTask.tags ?? [],
    relations: (dbTask.relations as unknown as TaskRelation[]) || [],
    attachments: (dbTask.attachments as unknown as TaskAttachment[]) || [],
    deliverables: (dbTask.deliverables as unknown as TaskDeliverable[]) || [],
    statusHistory: (() => {
      const history = dbTask.statusHistory && dbTask.statusHistory.length > 0
        ? dbTask.statusHistory.map((h) => ({
            fromStatus: h.fromStatus as TaskStatus | null,
            toStatus: h.toStatus as TaskStatus,
            changedAt: h.changedAt.toISOString(),
          }))
        : [];

      // If task is completed but has no "done" transition entry in status logs, force one
      if (dbTask.status === "done" && !history.some((h) => h.toStatus === "done")) {
        history.push({
          fromStatus: null,
          toStatus: "done" as TaskStatus,
          changedAt: (dbTask.completedAt || dbTask.createdAt).toISOString(),
        });
      } else if (history.length === 0) {
        // Fallback for non-completed tasks with empty logs
        history.push({
          fromStatus: null,
          toStatus: dbTask.status as TaskStatus,
          changedAt: dbTask.createdAt.toISOString(),
        });
      }
      return history;
    })(),
    comments: dbTask.comments
      ? dbTask.comments.map((c) => ({
          id: c.id,
          content: c.content,
          authorName: c.author.name || c.author.email,
          createdAt: c.createdAt.toISOString(),
        }))
      : [],
  };
}


export type TasksAction =
  | { type: "create"; id: string; changedAt: string; values: TaskFormValues }
  | { type: "update"; id: string; changedAt: string; values: TaskFormValues }
  | { type: "delete"; id: string }
  | { type: "replaceId"; tempId: string; realId: string }
  | { type: "restore"; task: Task }
  | { type: "insert"; task: Task }
  | { type: "sync"; task: Task }
  | { type: "addTime"; id: string; seconds: number }
  | { type: "reset"; tasks: Task[] }
  | { type: "append"; tasks: Task[] }
  | { type: "togglePin"; id: string; pinned: boolean }
  | { type: "addComment"; taskId: string; comment: TaskComment };

/** Builds a fresh Task from form values — shared by `create` and by duplicateTask in TasksProvider. */
export function buildTaskFromValues(id: string, changedAt: string, values: TaskFormValues): Task {
  return {
    id,
    code: `TEMP-${id.slice(0, 8)}`,
    title: values.title,
    description: values.description,
    project: values.project,
    status: values.status,
    type: values.type,
    priority: values.priority,
    effort: values.effort,
    storyPoint: values.storyPoint,
    startDate: values.startDate,
    dueDate: values.dueDate,
    waitingOn: values.waitingOn,
    sprint: values.sprint,
    reporter: values.reporter,
    pinned: false,
    tags: values.tags,
    relations: values.relations,
    attachments: values.attachments,
    deliverables: values.deliverables,
    statusHistory: [{ fromStatus: null, toStatus: values.status, changedAt }],
    completedAt: values.status === "done" ? changedAt : undefined,
    createdAt: changedAt,
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
          startDate: action.values.startDate,
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
          completedAt: statusChanged
            ? (action.values.status === "done" ? action.changedAt : undefined)
            : t.completedAt,
        };
      });
    }
    case "delete": {
      return tasks.filter((t) => t.id !== action.id);
    }
    case "replaceId": {
      return tasks.map((t) => (t.id === action.tempId ? { ...t, id: action.realId } : t));
    }
    case "restore": {
      if (tasks.some((t) => t.id === action.task.id)) return tasks;
      return [...tasks, action.task];
    }
    case "insert": {
      if (tasks.some((t) => t.id === action.task.id)) return tasks;
      return [action.task, ...tasks];
    }
    case "sync": {
      return tasks.map((t) => (t.id === action.task.id ? action.task : t));
    }
    case "addTime": {
      return tasks.map((t) => (t.id === action.id ? { ...t, timeSpentSeconds: (t.timeSpentSeconds ?? 0) + action.seconds } : t));
    }
    case "reset": {
      return action.tasks;
    }
    case "append": {
      const existingIds = new Set(tasks.map((t) => t.id));
      const newTasks = action.tasks.filter((t) => !existingIds.has(t.id));
      return [...tasks, ...newTasks];
    }
    case "togglePin": {
      return tasks.map((t) => (t.id === action.id ? { ...t, pinned: action.pinned } : t));
    }
    case "addComment": {
      return tasks.map((t) =>
        t.id === action.taskId
          ? { ...t, comments: [...(t.comments || []), action.comment] }
          : t
      );
    }
    default:
      return tasks;
  }
}

export function mapDbProjectToClient(dbProject: DbProject): Project {
  return {
    id: dbProject.id,
    name: dbProject.name,
    code: dbProject.code ?? undefined,
    colorVar: dbProject.colorVar,
    customColor: dbProject.customColor ?? undefined,
    emoji: dbProject.emoji,
    category: fromDbProjectCategory(dbProject.category),
    description: dbProject.description ?? "",
    status: dbProject.status as Project["status"],
  };
}

export function mapDbSprintToClient(dbSprint: DbSprint & { projects?: { id: string }[] }): Sprint {
  return {
    id: dbSprint.id,
    name: dbSprint.name,
    projectIds: dbSprint.projects?.map((p) => p.id) ?? [],
    startDate: dbSprint.startDate.toISOString().split("T")[0],
    endDate: dbSprint.endDate.toISOString().split("T")[0],
    status: dbSprint.status as Sprint["status"],
    goal: dbSprint.goal ?? "",
  };
}
