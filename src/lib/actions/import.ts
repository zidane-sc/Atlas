"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Task, Priority, TaskStatus, TaskType, TaskSize } from "@/types/task";
import type { ActionResult } from "@/lib/actions/types";
import { toDbProjectCategory } from "@/lib/schemas/project";
import { Prisma } from "@/generated/prisma/client";
import type {
  ProjectCategory,
  ProjectStatus,
  TaskStatus as DbTaskStatus,
  TaskType as DbTaskType,
  TaskPriority as DbTaskPriority,
  TaskSize as DbTaskSize,
  TaskReporter as DbTaskReporter,
} from "@/generated/prisma/client";
import { mapDbTaskToClient } from "@/lib/tasks-reducer";
import { validateImportPayload } from "@/lib/validation/import-validation";
import type { ImportPayload, WorkSessionExport, ActivityLogExport } from "@/lib/types/import-types";

export { validateImportPayload };
export type { ImportPayload, WorkSessionExport, ActivityLogExport } from "@/lib/types/import-types";

function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date format: "${dateStr}". Expected ISO 8601 format.`);
  }
  return date;
}

function normalizeTaskStatus(status: unknown): DbTaskStatus {
  const s = String(status || "").toLowerCase();
  if (s === "inbox") return "backlog";
  if (s === "ready" || s === "blocked" || s === "waiting_external") return "todo";
  if (s === "testing") return "in_progress";
  if (["backlog", "todo", "in_progress", "done", "archived"].includes(s)) {
    return s as DbTaskStatus;
  }
  return "todo";
}

function normalizeTaskType(type: unknown): DbTaskType {
  const t = String(type || "").toLowerCase();
  if (["investigation", "study", "analysis"].includes(t)) return "research";
  if (["deployment", "maintenance", "refactor"].includes(t)) return "admin";
  if (t === "incident") return "bug";
  if (t === "communication") return "meeting";
  if (["coding", "research", "design", "documentation", "bug", "meeting", "admin"].includes(t)) {
    return t as DbTaskType;
  }
  return "coding";
}

function normalizeTaskPriority(priority: unknown): DbTaskPriority {
  const p = String(priority || "").toLowerCase();
  if (p === "p0" || p === "p1") return "high";
  if (p === "p2") return "medium";
  if (p === "p3" || p === "p4") return "low";
  if (["high", "medium", "low"].includes(p)) return p as DbTaskPriority;
  return "medium";
}

function normalizeTaskSize(size: unknown): DbTaskSize | null {
  if (!size) return null;
  const s = String(size).toLowerCase();
  if (["xs", "s", "m", "l", "xl"].includes(s)) return s as DbTaskSize;
  return null;
}

function normalizeProjectStatus(status: unknown): ProjectStatus {
  const s = String(status || "").toLowerCase();
  if (s === "completed") return "completed";
  if (s === "archived") return "archived";
  return "active";
}

export async function getWorkspaceHistoryForExport(): Promise<
  ActionResult<{ workSessions: WorkSessionExport[]; activityLogs: ActivityLogExport[] }>
> {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
  }

  const user = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
  if (!user) {
    return { success: false, error: { code: "NOT_FOUND", message: "User not found." } };
  }

  const [rawWorkSessions, rawActivityLogs] = await Promise.all([
    db.workSession.findMany({
      where: { task: { ownerId: user.id } },
      select: { taskId: true, startedAt: true, endedAt: true, durationSeconds: true },
    }),
    db.activityLog.findMany({
      where: { actorId: user.id },
      select: { taskId: true, projectId: true, action: true, details: true, createdAt: true },
    }),
  ]);

  return {
    success: true,
    data: {
      workSessions: rawWorkSessions.map((w) => ({
        taskId: w.taskId,
        startedAt: w.startedAt.toISOString(),
        endedAt: w.endedAt.toISOString(),
        durationSeconds: w.durationSeconds,
      })),
      activityLogs: rawActivityLogs.map((a) => ({
        taskId: a.taskId,
        projectId: a.projectId,
        action: a.action,
        details: a.details,
        createdAt: a.createdAt.toISOString(),
      })),
    },
  };
}

export async function getTasksForExport(): Promise<
  ActionResult<{ tasks: Task[]; decorations: { purchased: string[]; placed: Record<string, string | null> }; savedFilters: any[] }>
> {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, purchasedDecorations: true, placedDecorations: true, savedFilters: true },
  });
  if (!user) {
    return { success: false, error: { code: "NOT_FOUND", message: "User not found." } };
  }

  const [dbTasks, dbProjects] = await Promise.all([
    db.task.findMany({
      where: { ownerId: user.id, deletedAt: null },
      orderBy: { createdAt: "asc" },
      include: {
        statusHistory: { orderBy: { changedAt: "asc" } },
        comments: { orderBy: { createdAt: "asc" }, include: { author: true } },
      },
    }),
    db.project.findMany({ where: { ownerId: user.id, archivedAt: null } }),
  ]);

  return {
    success: true,
    data: {
      tasks: dbTasks.map((t) => mapDbTaskToClient(t, dbProjects, [])),
      decorations: {
        purchased: (user.purchasedDecorations as string[]) || [],
        placed: (user.placedDecorations as Record<string, string | null>) || {},
      },
      savedFilters: (user.savedFilters as any[]) || [],
    },
  };
}

export async function importWorkspaceData(
  payload: ImportPayload
): Promise<ActionResult<{ success: boolean }>> {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
  }

  try {
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return { success: false, error: { code: "NOT_FOUND", message: "User not found." } };
    }

    const { tasks, projects, bonus, workSessions = [], activityLogs = [], decorations, savedFilters = [] } = payload;
    const taskIds = new Set(tasks.map((t) => t.id));

    await db.$transaction(async (tx) => {
      // 1. Wipe existing user data
      await tx.taskStatusLog.deleteMany({ where: { task: { ownerId: user.id } } });
      await tx.comment.deleteMany({ where: { task: { ownerId: user.id } } });
      await tx.activityLog.deleteMany({ where: { actorId: user.id } });
      await tx.workSession.deleteMany({ where: { task: { ownerId: user.id } } });
      await tx.taskRelation.deleteMany({ where: { task: { ownerId: user.id } } });
      await tx.attachment.deleteMany({ where: { task: { ownerId: user.id } } });
      await tx.deliverable.deleteMany({ where: { task: { ownerId: user.id } } });
      await tx.taskTag.deleteMany({ where: { task: { ownerId: user.id } } });
      await tx.task.deleteMany({ where: { ownerId: user.id } });
      await tx.project.deleteMany({ where: { ownerId: user.id } });

      // 2. Insert Projects
      if (projects.length > 0) {
        await tx.project.createMany({
          data: projects.map((p, idx) => {
            try {
              return {
                id: p.id,
                ownerId: user.id,
                name: p.name,
                category: toDbProjectCategory(p.category) as ProjectCategory,
                colorVar: p.colorVar || "--color-primary-gold",
                emoji: p.emoji || "📁",
                description: p.description || null,
                status: normalizeProjectStatus(p.status),
              };
            } catch (e) {
              throw new Error(`Project ${idx} (${p.name}): ${e instanceof Error ? e.message : String(e)}`);
            }
          }),
        });
      }

      // 3. Insert Tasks
      const projectNameMap = new Map(projects.map((p) => [p.name, p.id]));
      const taskCreateData: Prisma.TaskCreateManyInput[] = [];
      const allComments: Prisma.CommentCreateManyInput[] = [];
      const allStatusLogs: Prisma.TaskStatusLogCreateManyInput[] = [];

      for (let taskIdx = 0; taskIdx < tasks.length; taskIdx++) {
        const t = tasks[taskIdx];
        try {
          const projectId = t.project ? (projectNameMap.get(t.project) ?? null) : null;

          taskCreateData.push({
            id: t.id,
            title: t.title,
            description: t.description || null,
            projectId,
            status: normalizeTaskStatus(t.status),
            type: normalizeTaskType(t.type),
            priority: normalizeTaskPriority(t.priority),
            size: normalizeTaskSize(t.size),
            reporter: (t.reporter as DbTaskReporter) || "self",
            ownerId: user.id,
            timeSpentSeconds: t.timeSpentSeconds || 0,
            dueDate: t.dueDate ? parseDate(t.dueDate) : null,
            completedAt: t.status === "done" ? new Date() : null,
          });

          if (t.comments && t.comments.length > 0) {
            for (const c of t.comments) {
              allComments.push({
                id: c.id,
                taskId: t.id,
                authorId: user.id,
                content: `[${c.authorName}]: ${c.content}`,
                createdAt: parseDate(c.createdAt) || new Date(),
              });
            }
          }

          if (t.statusHistory && t.statusHistory.length > 0) {
            for (const h of t.statusHistory) {
              allStatusLogs.push({
                id: crypto.randomUUID(),
                taskId: t.id,
                fromStatus: h.fromStatus ? normalizeTaskStatus(h.fromStatus) : null,
                toStatus: normalizeTaskStatus(h.toStatus),
                changedAt: parseDate(h.changedAt) || new Date(),
              });
            }
          }
        } catch (e) {
          throw new Error(`Task ${taskIdx} (${t.title}): ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      if (taskCreateData.length > 0) {
        await tx.task.createMany({ data: taskCreateData });
      }
      if (allComments.length > 0) {
        await tx.comment.createMany({ data: allComments });
      }
      if (allStatusLogs.length > 0) {
        await tx.taskStatusLog.createMany({ data: allStatusLogs });
      }

      // 4. Restore Focus Timer work sessions
      const validWorkSessions = workSessions.filter((w) => taskIds.has(w.taskId));
      if (validWorkSessions.length > 0) {
        await tx.workSession.createMany({
          data: validWorkSessions.map((w) => ({
            taskId: w.taskId,
            startedAt: parseDate(w.startedAt)!,
            endedAt: parseDate(w.endedAt)!,
            durationSeconds: w.durationSeconds,
          })),
        });
      }

      // 5. Restore Activity logs
      const validActivityLogs = activityLogs.filter(
        (a) => (a.taskId == null || taskIds.has(a.taskId)) && (a.projectId == null || projects.some((p) => p.id === a.projectId))
      );
      if (validActivityLogs.length > 0) {
        await tx.activityLog.createMany({
          data: validActivityLogs.map((a) => ({
            actorId: user.id,
            taskId: a.taskId,
            projectId: a.projectId,
            action: a.action,
            details: (a.details ?? undefined) as Prisma.InputJsonValue | undefined,
            createdAt: parseDate(a.createdAt) || new Date(),
          })),
        });
      }

      // 6. Update user stats
      const bonusXp = typeof bonus.xp === "number" ? Math.max(0, Math.floor(bonus.xp)) : 0;
      const bonusCoins = typeof bonus.coins === "number" ? Math.max(0, Math.floor(bonus.coins)) : 0;

      await tx.user.update({
        where: { id: user.id },
        data: {
          bonusXp,
          bonusCoins,
          purchasedDecorations: decorations?.purchased || [],
          placedDecorations: decorations?.placed || {},
          savedFilters: savedFilters || [],
        },
        select: { id: true },
      });
    });

    return { success: true, data: { success: true } };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Failed to import workspace data:", errorMsg);
    return {
      success: false,
      error: {
        code: "INTERNAL",
        message: `Import failed: ${errorMsg}`,
      },
    };
  }
}
