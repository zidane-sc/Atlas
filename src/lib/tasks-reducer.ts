import type { Task, TaskStatus, TaskType, Priority, Effort, Reporter, TaskAttachment, TaskDeliverable, TaskRelation, TaskComment } from "@/types/task";
import type { TaskFormValues } from "@/lib/schemas/task";
import type { Task as DbTask, Project as DbProject, Sprint as DbSprint, TaskStatusLog, Comment as DbComment, User as DbUser } from "@/generated/prisma/client";
import type { Project, Sprint } from "@/types/gamification";

export const PROJECT_MAP: Record<string, string> = {
  "ATS": "a0665f80-7a0e-4364-8848-d39f60d3d5f1",
  "Thesis": "b04e6c9a-d762-4217-a066-6b22b2ee709a",
  "Client A": "c0559f23-64be-4581-807e-1284eb3b7280",
  "Atlas": "d09ef1b3-4f24-4f40-8bde-d51025a17688",
  "Group Project": "e03bf3ab-d886-455f-8647-5d2bc50e3025",
  "Full-time": "f0f9c2d1-2ee3-4927-99df-1c7c10b429a3",
};

export const PROJECT_REV_MAP: Record<string, string> = {
  "a0665f80-7a0e-4364-8848-d39f60d3d5f1": "ATS",
  "b04e6c9a-d762-4217-a066-6b22b2ee709a": "Thesis",
  "c0559f23-64be-4581-807e-1284eb3b7280": "Client A",
  "d09ef1b3-4f24-4f40-8bde-d51025a17688": "Atlas",
  "e03bf3ab-d886-455f-8647-5d2bc50e3025": "Group Project",
  "f0f9c2d1-2ee3-4927-99df-1c7c10b429a3": "Full-time",
};

export const SPRINT_MAP: Record<string, string> = {
  "Sprint 7 — The Awakening": "77777777-7777-7777-7777-777777777777",
  "Sprint 6 — Dark Passage": "66666666-6666-6666-6666-666666666666",
  "Sprint 8 — The Reckoning": "88888888-8888-8888-8888-888888888888",
};

export const SPRINT_REV_MAP: Record<string, string> = {
  "77777777-7777-7777-7777-777777777777": "Sprint 7 — The Awakening",
  "66666666-6666-6666-6666-666666666666": "Sprint 6 — Dark Passage",
  "88888888-8888-8888-8888-888888888888": "Sprint 8 — The Reckoning",
};

export type DbTaskWithLogs = DbTask & {
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
    project: project ? project.name : (dbTask.projectId ? (PROJECT_REV_MAP[dbTask.projectId] ?? "Atlas") : "Atlas"),
    status: dbTask.status as TaskStatus,
    type: dbTask.type as TaskType,
    priority: dbTask.priority as Priority,
    effort: (dbTask.effort ?? undefined) as Effort | undefined,
    storyPoint: dbTask.storyPoint ?? undefined,
    timeSpentSeconds: dbTask.timeSpentSeconds,
    pinned: dbTask.pinned,
    dueDate: dbTask.dueDate ? dbTask.dueDate.toISOString().split("T")[0] : undefined,
    completedAt: dbTask.completedAt ? dbTask.completedAt.toISOString() : undefined,
    sprint: sprint ? sprint.name : (dbTask.sprintId ? (SPRINT_REV_MAP[dbTask.sprintId] ?? undefined) : undefined),
    reporter: dbTask.reporter as Reporter,
    tags: dbTask.tags,
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
  | { type: "addTime"; id: string; seconds: number }
  | { type: "reset"; tasks: Task[] }
  | { type: "togglePin"; id: string; pinned: boolean }
  | { type: "addComment"; taskId: string; comment: TaskComment };

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
    pinned: false,
    tags: values.tags,
    relations: values.relations,
    attachments: values.attachments,
    deliverables: values.deliverables,
    statusHistory: [{ fromStatus: null, toStatus: values.status, changedAt }],
    completedAt: values.status === "done" ? changedAt : undefined,
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
    case "addTime": {
      return tasks.map((t) => (t.id === action.id ? { ...t, timeSpentSeconds: (t.timeSpentSeconds ?? 0) + action.seconds } : t));
    }
    case "reset": {
      return action.tasks;
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
    colorVar: dbProject.colorVar,
    customColor: dbProject.customColor ?? undefined,
    emoji: dbProject.emoji,
    category: dbProject.category as string,
    description: dbProject.description ?? "",
    status: dbProject.status as Project["status"],
  };
}

export function mapDbSprintToClient(dbSprint: DbSprint): Sprint {
  return {
    id: dbSprint.id,
    name: dbSprint.name,
    startDate: dbSprint.startDate.toISOString().split("T")[0],
    endDate: dbSprint.endDate.toISOString().split("T")[0],
    status: dbSprint.status as Sprint["status"],
    goal: dbSprint.goal ?? "",
  };
}
