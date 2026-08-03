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
import { validateImportPayload, type ValidationError, type ImportValidationResult } from "@/lib/validation/import-validation";

export type { ValidationError, ImportValidationResult };
export { validateImportPayload };

function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date format: "${dateStr}". Expected ISO 8601 format.`);
  }
  return date;
}

const validTaskStatuses = new Set(["inbox", "todo", "ready", "in_progress", "blocked", "waiting_external", "testing", "done"]);
const validTaskTypes = new Set(["coding", "design", "documentation", "testing", "devops", "other"]);
const validTaskPriorities = new Set(["p0", "p1", "p2", "p3"]);
const validTaskEfforts = new Set(["xs", "s", "m", "l", "xl", "xxl"]);
const validProjectStatuses = new Set(["active", "archived", "paused"]);
const validSprintStatuses = new Set(["planning", "active", "completed", "cancelled"]);

function validateTaskStatus(status: unknown): TaskStatus {
  if (typeof status !== "string" || !validTaskStatuses.has(status)) {
    throw new Error(`Invalid task status: "${status}". Must be one of: ${Array.from(validTaskStatuses).join(", ")}`);
  }
  return status as TaskStatus;
}

function validateTaskType(type: unknown): TaskType {
  if (typeof type !== "string" || !validTaskTypes.has(type)) {
    throw new Error(`Invalid task type: "${type}". Must be one of: ${Array.from(validTaskTypes).join(", ")}`);
  }
  return type as TaskType;
}

function validateTaskPriority(priority: unknown): TaskPriority {
  if (typeof priority !== "string" || !validTaskPriorities.has(priority)) {
    throw new Error(`Invalid task priority: "${priority}". Must be one of: ${Array.from(validTaskPriorities).join(", ")}`);
  }
  return priority as TaskPriority;
}

function validateTaskEffort(effort: unknown): TaskEffort | null {
  if (effort === null || effort === undefined) return null;
  if (typeof effort !== "string" || !validTaskEfforts.has(effort)) {
    throw new Error(`Invalid task effort: "${effort}". Must be one of: ${Array.from(validTaskEfforts).join(", ")}`);
  }
  return effort as TaskEffort;
}

function validateProjectStatus(status: unknown): ProjectStatus {
  if (typeof status !== "string" || !validProjectStatuses.has(status)) {
    throw new Error(`Invalid project status: "${status}". Must be one of: ${Array.from(validProjectStatuses).join(", ")}`);
  }
  return status as ProjectStatus;
}

function validateSprintStatus(status: unknown): SprintStatus {
  if (typeof status !== "string" || !validSprintStatuses.has(status)) {
    throw new Error(`Invalid sprint status: "${status}". Must be one of: ${Array.from(validSprintStatuses).join(", ")}`);
  }
  return status as SprintStatus;
}

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

export interface NoteAttachmentExport {
  id: string;
  noteId: string;
  url: string;
  fileName: string;
  fileType: string | null;
}

export interface NoteTaskLinkExport {
  noteId: string;
  taskId: string;
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
  attachments?: NoteAttachmentExport[];
  taskLinks?: NoteTaskLinkExport[];
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
      include: {
        attachments: true,
        taskLinks: true,
      },
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
        attachments: n.attachments.map((a) => ({
          id: a.id,
          noteId: a.noteId,
          url: a.url,
          fileName: a.fileName,
          fileType: a.fileType,
        })),
        taskLinks: n.taskLinks.map((l) => ({
          noteId: l.noteId,
          taskId: l.taskId,
          createdAt: l.createdAt.toISOString(),
        })),
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
          data: projects.map((p, idx) => {
            try {
              return {
                id: p.id,
                name: p.name,
                category: toDbProjectCategory(p.category) as ProjectCategory,
                colorVar: p.colorVar,
                emoji: p.emoji,
                description: p.description || null,
                status: validateProjectStatus(p.status),
              };
            } catch (e) {
              throw new Error(`Project ${idx} (${p.name}): ${e instanceof Error ? e.message : String(e)}`);
            }
          }),
        });
      }

      // 3. Insert Sprints
      if (sprints.length > 0) {
        await tx.sprint.createMany({
          data: sprints.map((s, idx) => {
            try {
              return {
                id: s.id,
                name: s.name,
                startDate: parseDate(s.startDate)!,
                endDate: parseDate(s.endDate)!,
                status: validateSprintStatus(s.status),
                goal: s.goal || null,
              };
            } catch (e) {
              throw new Error(`Sprint ${idx} (${s.name}): ${e instanceof Error ? e.message : String(e)}`);
            }
          }),
        });
      }

      // 4. Insert Tasks & nested items
      for (let taskIdx = 0; taskIdx < tasks.length; taskIdx++) {
        const t = tasks[taskIdx];
        try {
          // Resolve project and sprint IDs by name if they exist
          let projectId: string | null = null;
          if (t.project) {
            const prj = projects.find((p) => p.name === t.project);
            if (!prj && t.project) {
              console.warn(`Task ${taskIdx} (${t.title}): Project "${t.project}" not found in import, will be unlinked`);
            }
            projectId = prj?.id ?? null;
          }

          let sprintId: string | null = null;
          if (t.sprint) {
            const spr = sprints.find((s) => s.name === t.sprint);
            if (!spr && t.sprint) {
              console.warn(`Task ${taskIdx} (${t.title}): Sprint "${t.sprint}" not found in import, will be unlinked`);
            }
            sprintId = spr?.id ?? null;
          }

          await tx.task.create({
            data: {
              id: t.id,
              title: t.title,
              description: t.description || null,
              projectId,
              sprintId,
              status: validateTaskStatus(t.status),
              type: validateTaskType(t.type),
              priority: validateTaskPriority(t.priority),
              effort: validateTaskEffort(t.effort),
              storyPoint: t.storyPoint || null,
              reporter: (t.reporter as TaskReporter) || "self",
              ownerId: user.id,
              tags: t.tags || [],
              relations: t.relations as unknown as Prisma.InputJsonValue,
              attachments: t.attachments as unknown as Prisma.InputJsonValue,
              deliverables: t.deliverables as unknown as Prisma.InputJsonValue,
              timeSpentSeconds: t.timeSpentSeconds || 0,
              dueDate: t.dueDate ? parseDate(t.dueDate) : null,
              completedAt: t.status === "done" ? new Date() : null,
            },
          });
        } catch (e) {
          throw new Error(`Task ${taskIdx} (${t.title}): ${e instanceof Error ? e.message : String(e)}`);
        }

        // Insert Comments for this task, preserving original author info
        if (t.comments && t.comments.length > 0) {
          await tx.comment.createMany({
            data: t.comments.map((c) => ({
              id: c.id,
              taskId: t.id,
              authorId: user.id,
              content: `[${c.authorName}]: ${c.content}`,
              createdAt: parseDate(c.createdAt) || new Date(),
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
              changedAt: parseDate(h.changedAt) || new Date(),
            })),
          });
        }
      }

      // 5. Insert Notes with attachments and task links
      if (notes.length > 0) {
        await tx.note.createMany({
          data: notes.map((n) => ({
            id: n.id,
            userId: user.id,
            title: n.title,
            content: n.content,
            tags: n.tags,
            pinned: n.pinned,
            createdAt: parseDate(n.createdAt)!,
            updatedAt: parseDate(n.updatedAt)!,
          })),
        });

        // Insert Note Attachments
        const allAttachments = notes.flatMap((n) =>
          (n.attachments ?? []).map((a) => ({
            id: a.id,
            noteId: a.noteId,
            url: a.url,
            fileName: a.fileName,
            fileType: a.fileType,
          }))
        );
        if (allAttachments.length > 0) {
          await tx.noteAttachment.createMany({ data: allAttachments });
        }

        // Insert Note Task Links (only if tasks were imported)
        const validTaskLinks = notes
          .flatMap((n) =>
            (n.taskLinks ?? []).map((l) => ({
              noteId: l.noteId,
              taskId: l.taskId,
              createdAt: parseDate(l.createdAt) || new Date(),
            }))
          )
          .filter((l) => taskIds.has(l.taskId));
        if (validTaskLinks.length > 0) {
          await tx.noteTaskLink.createMany({ data: validTaskLinks });
        }
      }

      // 6. Restore Focus Timer history and the activity feed — previously dropped on
      // re-import even though the wipe step above deletes both (docs/05-backlog.md §6).
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
            createdAt: parseDate(a.createdAt) || new Date(),
          })),
        });
      }

      // 7. Update user stats with decorations and saved filters
      const bonusXp = typeof bonus.xp === "number" ? Math.max(0, Math.floor(bonus.xp)) : 0;
      const bonusCoins = typeof bonus.coins === "number" ? Math.max(0, Math.floor(bonus.coins)) : 0;
      if (typeof bonus.xp !== "number" || typeof bonus.coins !== "number") {
        console.warn(`Import: bonus XP/coins had invalid types, reset to 0. Expected numbers, got xp=${typeof bonus.xp}, coins=${typeof bonus.coins}`);
      }

      await tx.user.update({
        where: { id: user.id },
        data: {
          bonusXp,
          bonusCoins,
          purchasedDecorations: decorations?.purchased || [],
          placedDecorations: decorations?.placed || {},
          savedFilters: savedFilters || [],
        },
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
