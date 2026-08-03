"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Task } from "@/types/task";
import type { Project, Sprint } from "@/types/gamification";
import type { ActionResult } from "@/lib/actions/types";
import { toDbProjectCategory } from "@/lib/schemas/project";
import { Prisma } from "@/generated/prisma/client";
import type { ProjectCategory, ProjectStatus, SprintStatus, TaskStatus, TaskType, TaskPriority, TaskEffort, TaskReporter } from "@/generated/prisma/client";
import { mapDbTaskToClient } from "@/lib/tasks-reducer";

export interface WorkSessionExport {
  taskId: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
}

export interface ActivityLogExport {
  taskId: string | null;
  projectId: string | null;
  sprintId: string | null;
  action: string;
  details: unknown;
  createdAt: string;
}

export interface NoteExport {
  id: string;
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ImportPayload {
  tasks: Task[];
  projects: Project[];
  sprints: Sprint[];
  bonus: { xp: number; coins: number };
  workSessions?: WorkSessionExport[];
  activityLogs?: ActivityLogExport[];
  notes?: NoteExport[];
  decorations?: { purchased: string[]; placed: Record<string, string | null> };
  savedFilters?: any[];
}

/**
 * Raw WorkSession/ActivityLog rows for a full export — the client-held `tasks`/`activityLogs`
 * state is either aggregated (timeSpentSeconds) or display-shaped and take(10)-capped, so a
 * faithful round-trip needs a fresh, complete query straight from the DB (docs/05-backlog.md §6).
 */
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
      select: { taskId: true, projectId: true, sprintId: true, action: true, details: true, createdAt: true },
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
        sprintId: a.sprintId,
        action: a.action,
        details: a.details,
        createdAt: a.createdAt.toISOString(),
      })),
    },
  };
}

/**
 * Fresh, complete task fetch straight from the DB for export — the client-held `tasks` state
 * is capped at 200 tasks and, since the bulk fetch dropped its nested `statusHistory`/`comments`
 * includes for performance (docs/05-backlog.md §8 finding #16), no longer carries full history
 * for any task except whichever one currently has its edit sheet open. A backup must not depend
 * on either limitation — this queries every non-deleted task with its complete history/comments,
 * with no `take` limit, same one-time-cost tradeoff already accepted by
 * `getWorkspaceHistoryForExport` above.
 */
export async function getTasksForExport(): Promise<ActionResult<{ tasks: Task[]; notes: NoteExport[]; decorations: { purchased: string[]; placed: Record<string, string | null> }; savedFilters: any[] }>> {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
  }

  const user = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true, purchasedDecorations: true, placedDecorations: true, savedFilters: true } });
  if (!user) {
    return { success: false, error: { code: "NOT_FOUND", message: "User not found." } };
  }

  const [dbTasks, dbProjects, dbSprints, dbNotes] = await Promise.all([
    db.task.findMany({
      where: { ownerId: user.id, deletedAt: null },
      orderBy: { createdAt: "asc" },
      include: {
        statusHistory: { orderBy: { changedAt: "asc" } },
        comments: { orderBy: { createdAt: "asc" }, include: { author: true } },
      },
    }),
    db.project.findMany({ where: { archivedAt: null } }),
    db.sprint.findMany(),
    db.note.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return {
    success: true,
    data: {
      tasks: dbTasks.map((t) => mapDbTaskToClient(t, dbProjects, dbSprints)),
      notes: dbNotes.map((n) => ({
        id: n.id,
        title: n.title,
        content: n.content,
        tags: n.tags,
        pinned: n.pinned,
        createdAt: n.createdAt.toISOString(),
        updatedAt: n.updatedAt.toISOString(),
      })),
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

    const { tasks, projects, sprints, bonus, workSessions = [], activityLogs = [], notes = [], decorations, savedFilters = [] } = payload;
    const taskIds = new Set(tasks.map((t) => t.id));

    await db.$transaction(async (tx) => {
      // 1. Wipe existing data
      await tx.taskStatusLog.deleteMany({});
      await tx.comment.deleteMany({});
      await tx.activityLog.deleteMany({});
      await tx.workSession.deleteMany({});
      await tx.noteTaskLink.deleteMany({});
      await tx.noteAttachment.deleteMany({});
      await tx.noteLink.deleteMany({});
      await tx.note.deleteMany({});
      await tx.task.deleteMany({});
      await tx.project.deleteMany({});
      await tx.sprint.deleteMany({});

      // 2. Insert Projects
      if (projects.length > 0) {
        await tx.project.createMany({
          data: projects.map((p) => ({
            id: p.id,
            name: p.name,
            category: toDbProjectCategory(p.category) as ProjectCategory,
            colorVar: p.colorVar,
            emoji: p.emoji,
            description: p.description || null,
            status: p.status as ProjectStatus,
          })),
        });
      }

      // 3. Insert Sprints
      if (sprints.length > 0) {
        await tx.sprint.createMany({
          data: sprints.map((s) => ({
            id: s.id,
            name: s.name,
            startDate: new Date(s.startDate),
            endDate: new Date(s.endDate),
            status: s.status as SprintStatus,
            goal: s.goal || null,
          })),
        });
      }

      // 4. Insert Tasks & nested items
      for (const t of tasks) {
        // Resolve project and sprint IDs by name if they exist
        let projectId: string | null = null;
        if (t.project) {
          const prj = projects.find((p) => p.name === t.project);
          if (prj) projectId = prj.id;
        }

        let sprintId: string | null = null;
        if (t.sprint) {
          const spr = sprints.find((s) => s.name === t.sprint);
          if (spr) sprintId = spr.id;
        }

        await tx.task.create({
          data: {
            id: t.id,
            title: t.title,
            description: t.description || null,
            projectId,
            sprintId,
            status: t.status as TaskStatus,
            type: t.type as TaskType,
            priority: t.priority as TaskPriority,
            effort: t.effort ? (t.effort as TaskEffort) : null,
            storyPoint: t.storyPoint || null,
            reporter: (t.reporter as TaskReporter) || "self",
            ownerId: user.id,
            dueDate: t.dueDate ? new Date(t.dueDate) : null,
            tags: t.tags,
            relations: t.relations as unknown as Prisma.InputJsonValue,
            attachments: t.attachments as unknown as Prisma.InputJsonValue,
            deliverables: t.deliverables as unknown as Prisma.InputJsonValue,
            timeSpentSeconds: t.timeSpentSeconds || 0,
            completedAt: t.status === "done" ? new Date() : null, // fallback
          },
        });

        // Insert Comments for this task
        if (t.comments && t.comments.length > 0) {
          await tx.comment.createMany({
            data: t.comments.map((c) => ({
              id: c.id,
              taskId: t.id,
              authorId: user.id,
              content: c.content,
              createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
            })),
          });
        }

        // Insert Status History logs for this task
        if (t.statusHistory && t.statusHistory.length > 0) {
          await tx.taskStatusLog.createMany({
            data: t.statusHistory.map((h) => ({
              id: crypto.randomUUID(),
              taskId: t.id,
              fromStatus: h.fromStatus as TaskStatus | null,
              toStatus: h.toStatus as TaskStatus,
              changedAt: h.changedAt ? new Date(h.changedAt) : new Date(),
            })),
          });
        }
      }

      // 5. Insert Notes
      if (notes.length > 0) {
        await tx.note.createMany({
          data: notes.map((n) => ({
            id: n.id,
            userId: user.id,
            title: n.title,
            content: n.content,
            tags: n.tags,
            pinned: n.pinned,
            createdAt: new Date(n.createdAt),
            updatedAt: new Date(n.updatedAt),
          })),
        });
      }

      // 6. Restore Focus Timer history and the activity feed — previously dropped on
      // re-import even though the wipe step above deletes both (docs/05-backlog.md §6).
      const validWorkSessions = workSessions.filter((w) => taskIds.has(w.taskId));
      if (validWorkSessions.length > 0) {
        await tx.workSession.createMany({
          data: validWorkSessions.map((w) => ({
            taskId: w.taskId,
            startedAt: new Date(w.startedAt),
            endedAt: new Date(w.endedAt),
            durationSeconds: w.durationSeconds,
          })),
        });
      }

      const validActivityLogs = activityLogs.filter(
        (a) => (a.taskId == null || taskIds.has(a.taskId)) && (a.projectId == null || projects.some((p) => p.id === a.projectId)) && (a.sprintId == null || sprints.some((s) => s.id === a.sprintId))
      );
      if (validActivityLogs.length > 0) {
        await tx.activityLog.createMany({
          data: validActivityLogs.map((a) => ({
            actorId: user.id,
            taskId: a.taskId,
            projectId: a.projectId,
            sprintId: a.sprintId,
            action: a.action,
            details: (a.details ?? undefined) as Prisma.InputJsonValue | undefined,
            createdAt: new Date(a.createdAt),
          })),
        });
      }

      // 7. Update user stats with decorations and saved filters
      await tx.user.update({
        where: { id: user.id },
        data: {
          bonusXp: bonus.xp,
          bonusCoins: bonus.coins,
          purchasedDecorations: decorations?.purchased || [],
          placedDecorations: decorations?.placed || {},
          savedFilters: savedFilters || [],
        },
      });
    });

    return { success: true, data: { success: true } };
  } catch (error) {
    console.error("Failed to import workspace data:", error);
    return { success: false, error: { code: "INTERNAL", message: "Failed to import workspace data." } };
  }
}
