"use server";

import { auth } from "@/lib/auth";
import { logActivity } from "@/lib/actions/activity";
import { db } from "@/lib/db";
import { createTaskSchema, updateTaskSchema } from "@/lib/schemas/task";
import { Prisma, type Task } from "@/generated/prisma/client";
import type { ActionResult } from "@/lib/actions/types";
import { generateTaskCode, getNextTaskCodeNumber } from "@/lib/task-code";
import type { TaskComment, TaskStatus, TaskStatusLogEntry, TaskRelation, TaskAttachment, TaskDeliverable } from "@/types/task";
import { getCharacterSheetData, type CharacterSheetData } from "@/lib/character-sheet-data";
import { seedInitialData } from "@/lib/seeders/initial-data";
import { broadcastSyncEvent } from "@/lib/sync-events";
import { domainCreateTask, domainUpdateTask } from "@/lib/services/tasks-domain";

function toDate(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (value === "") return undefined;
  return new Date(value);
}


export async function createTask(
  input: unknown
): Promise<ActionResult<{ task: Task } & Partial<CharacterSheetData>>> {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
  }

  const owner = await db.user.upsert({
    where: { email: session.user.email },
    update: {},
    create: { email: session.user.email, name: session.user.name && session.user.name !== "Passcode" ? session.user.name : "Zidane Sc" },
    select: { id: true },
  });

  return domainCreateTask(owner.id, input);
}

export async function updateTask(
  id: string,
  input: unknown
): Promise<ActionResult<{ task: Task } & Partial<CharacterSheetData>>> {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
  }

  const owner = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
  if (!owner) {
    return { success: false, error: { code: "NOT_FOUND", message: "User not found." } };
  }

  return domainUpdateTask(owner.id, id, input);
}

export async function deleteTask(id: string): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
  }

  const owner = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
  if (!owner) {
    return { success: false, error: { code: "NOT_FOUND", message: "User not found." } };
  }

  try {
    await db.$transaction(async (tx) => {
      const existing = await tx.task.findFirst({
        where: { id, ownerId: owner.id, deletedAt: null },
        select: { title: true },
      });
      if (!existing) {
        throw new Error("NOT_FOUND");
      }

      await tx.task.update({
        where: { id, ownerId: owner.id },
        data: { deletedAt: new Date() },
      });

      await logActivity(tx, owner.id, {
        taskId: id,
        action: "deleted",
        details: { title: existing.title },
      });
    });

    await broadcastSyncEvent(owner.id, "task:deleted", { id });
    return { success: true, data: { id } };
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return { success: false, error: { code: "NOT_FOUND", message: "Task not found." } };
    }
    return { success: false, error: { code: "INTERNAL", message: "Failed to delete task." } };
  }
}

export async function restoreTask(id: string): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
  }

  const owner = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
  if (!owner) {
    return { success: false, error: { code: "NOT_FOUND", message: "User not found." } };
  }

  try {
    await db.$transaction(async (tx) => {
      const existing = await tx.task.findFirst({
        where: { id, ownerId: owner.id, deletedAt: { not: null } },
        select: { title: true },
      });
      if (!existing) {
        throw new Error("NOT_FOUND");
      }

      await tx.task.update({
        where: { id, ownerId: owner.id },
        data: { deletedAt: null },
      });

      await logActivity(tx, owner.id, {
        taskId: id,
        action: "restored",
        details: { title: existing.title },
      });
    });

    return { success: true, data: { id } };
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return { success: false, error: { code: "NOT_FOUND", message: "Deleted task not found." } };
    }
    return { success: false, error: { code: "INTERNAL", message: "Failed to restore task." } };
  }
}

export async function listDeletedTasks(): Promise<
  ActionResult<{ id: string; code: string | null; title: string; deletedAt: string }[]>
> {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
  }

  const owner = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
  if (!owner) {
    return { success: false, error: { code: "NOT_FOUND", message: "User not found." } };
  }

  const deleted = await db.task.findMany({
    where: { ownerId: owner.id, deletedAt: { not: null } },
    orderBy: { deletedAt: "desc" },
    take: 50,
    select: { id: true, code: true, title: true, deletedAt: true },
  });

  return {
    success: true,
    data: deleted.map((t) => ({ id: t.id, code: t.code, title: t.title, deletedAt: t.deletedAt!.toISOString() })),
  };
}

export async function logWorkSession(
  taskId: string,
  durationSeconds: number,
  startedAtStr: string,
  endedAtStr: string
): Promise<ActionResult<{ timeSpentSeconds: number }>> {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
  }

  const owner = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
  if (!owner) {
    return { success: false, error: { code: "NOT_FOUND", message: "User not found." } };
  }

  try {
    const updatedTask = await db.$transaction(async (tx) => {
      const task = await tx.task.findFirst({
        where: { id: taskId, ownerId: owner.id },
        select: { timeSpentSeconds: true },
      });
      if (!task) {
        throw new Error("NOT_FOUND");
      }

      await tx.workSession.create({
        data: {
          taskId,
          startedAt: new Date(startedAtStr),
          endedAt: new Date(endedAtStr),
          durationSeconds,
        },
        select: { id: true },
      });

      const updated = await tx.task.update({
        where: { id: taskId, ownerId: owner.id },
        data: {
          timeSpentSeconds: task.timeSpentSeconds + durationSeconds,
        },
        select: { timeSpentSeconds: true },
      });

      await logActivity(tx, owner.id, {
        taskId,
        action: "focused",
        details: { durationSeconds },
      });

      return updated;
    });

    return { success: true, data: { timeSpentSeconds: updatedTask.timeSpentSeconds } };
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return { success: false, error: { code: "NOT_FOUND", message: "Task not found." } };
    }
    return { success: false, error: { code: "INTERNAL", message: "Failed to log work session." } };
  }
}

export async function startFocusTimerAction(taskId: string, phase: "focus" | "break" = "focus"): Promise<ActionResult<{ success: boolean; taskMovedToInProgress?: boolean }>> {
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

    let taskMovedToInProgress = false;
    await db.$transaction(async (tx) => {
      const task = await tx.task.findFirst({
        where: { id: taskId, ownerId: user.id, deletedAt: null },
        select: { id: true, status: true },
      });
      if (!task) throw new Error("TASK_NOT_FOUND");

      // Auto-move to in_progress if currently backlog or todo
      if (phase === "focus" && task.status !== "in_progress") {
        await tx.task.update({
          where: { id: taskId },
          data: { status: "in_progress" },
        });
        await tx.taskStatusLog.create({
          data: {
            taskId,
            fromStatus: task.status,
            toStatus: "in_progress",
            changedAt: new Date(),
          },
        });
        taskMovedToInProgress = true;
      }

      await tx.user.update({
        where: { id: user.id },
        data: {
          activeTimerTaskId: taskId,
          activeTimerStartedAt: new Date(),
          activeTimerPhase: phase,
        },
      });
    });

    await broadcastSyncEvent(user.id, "timer:started", { taskId, phase, startedAt: Date.now() });
    if (taskMovedToInProgress) {
      await broadcastSyncEvent(user.id, "task:updated", { id: taskId, status: "in_progress" });
    }

    return { success: true, data: { success: true, taskMovedToInProgress } };
  } catch (error) {
    console.error("Failed to start focus timer:", error);
    return { success: false, error: { code: "INTERNAL", message: "Failed to start focus timer." } };
  }
}

export async function stopFocusTimerAction(): Promise<
  ActionResult<{ taskId: string; seconds: number; startedAt: string; endedAt: string; phase: string }>
> {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
  }

  try {
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, activeTimerTaskId: true, activeTimerStartedAt: true, activeTimerPhase: true },
    });

    if (!user || !user.activeTimerTaskId || !user.activeTimerStartedAt) {
      return { success: false, error: { code: "NOT_FOUND", message: "No active focus timer found." } };
    }

    const taskId = user.activeTimerTaskId;
    const startedAt = user.activeTimerStartedAt;
    const phase = user.activeTimerPhase;
    const endedAt = new Date();
    const seconds = Math.max(1, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000));

    await db.$transaction(async (tx) => {
      // Clear active timer fields on user
      await tx.user.update({
        where: { id: user.id },
        data: {
          activeTimerTaskId: null,
          activeTimerStartedAt: null,
          activeTimerPhase: "focus",
        },
      });

      // If it was a focus session, atomically record the WorkSession & increment task timeSpentSeconds
      if (phase === "focus") {
        await tx.workSession.create({
          data: {
            taskId,
            startedAt,
            endedAt,
            durationSeconds: seconds,
          },
        });

        await tx.task.update({
          where: { id: taskId },
          data: {
            timeSpentSeconds: { increment: seconds },
          },
        });

        await logActivity(tx, user.id, {
          taskId,
          action: "focused",
          details: { durationSeconds: seconds },
        });
      }
    });

    await broadcastSyncEvent(user.id, "timer:stopped", { taskId, seconds, phase });

    return {
      success: true,
      data: {
        taskId,
        seconds,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        phase,
      },
    };
  } catch (error) {
    console.error("Failed to stop focus timer:", error);
    return { success: false, error: { code: "INTERNAL", message: "Failed to stop focus timer." } };
  }
}

/**
 * On-demand full status history + comments for one task — the bulk task fetch (layout.tsx)
 * no longer includes either, for performance (docs/05-backlog.md §8 finding #16). Called when
 * TaskFormSheet opens an existing task, since that's the only place either is displayed.
 */
export interface TaskAgentDetails {
  runs: {
    id: string;
    agentName: string;
    sessionId: string | null;
    sessionTitle: string | null;
    platform: string | null;
    chatId: string | null;
    chatName: string | null;
    threadId: string | null;
    threadName: string | null;
    status: string;
    startedAt: string;
    endedAt: string | null;
    usageEvents: {
      id: string;
      model: string;
      provider: string | null;
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      costUsd: number | null;
      createdAt: string;
    }[];
  }[];
  checkpoints: {
    id: string;
    revision: number;
    summary: string;
    checkpointState: string | null;
    waitingReason: string | null;
    nextStep: string | null;
    createdAt: string;
  }[];
}

export async function getTaskDetails(
  taskId: string
): Promise<ActionResult<{
  tags: string[];
  relations: TaskRelation[];
  attachments: TaskAttachment[];
  deliverables: TaskDeliverable[];
  statusHistory: TaskStatusLogEntry[];
  comments: TaskComment[];
  agent?: TaskAgentDetails;
}>> {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return { success: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
    }

    const task = await db.task.findFirst({
      where: { id: taskId, owner: { email: session.user.email } },
      select: {
        tags: { select: { tag: { select: { name: true } } } },
        relations: { select: { relationType: true, relatedTask: { select: { id: true, title: true } } } },
        attachments: true,
        deliverables: true,
        statusHistory: {
          orderBy: { changedAt: "asc" },
          select: { fromStatus: true, toStatus: true, changedAt: true },
        },
        comments: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            content: true,
            createdAt: true,
            author: { select: { name: true, email: true } },
          },
        },
        agentRuns: {
          orderBy: { startedAt: "desc" },
          take: 10,
          select: {
            id: true,
            agentName: true,
            sessionId: true,
            sessionTitle: true,
            platform: true,
            chatId: true,
            chatName: true,
            threadId: true,
            threadName: true,
            status: true,
            startedAt: true,
            endedAt: true,
            usageEvents: {
              orderBy: { createdAt: "asc" },
              select: {
                id: true,
                model: true,
                provider: true,
                promptTokens: true,
                completionTokens: true,
                totalTokens: true,
                costUsd: true,
                createdAt: true,
              },
            },
          },
        },
        checkpoints: {
          orderBy: { revision: "desc" },
          take: 10,
          select: {
            id: true,
            revision: true,
            summary: true,
            checkpointState: true,
            waitingReason: true,
            nextStep: true,
            createdAt: true,
          },
        },
      },
    });

    if (!task) {
      return { success: false, error: { code: "NOT_FOUND", message: "Task not found." } };
    }

    return {
      success: true,
      data: {
        tags: task.tags?.map((t: any) => t.tag?.name || t).filter(Boolean) ?? [],
        relations: task.relations?.map((r: any) => ({
          relationType: r.relationType,
          taskId: r.relatedTask?.id,
          title: r.relatedTask?.title,
        })) ?? [],
        attachments: task.attachments?.map((a: any) => ({
          id: a.id,
          type: a.type,
          label: a.label ?? "",
          url: a.url,
        })) ?? [],
        deliverables: task.deliverables?.map((d: any) => ({
          id: d.id,
          type: d.type,
          label: d.label ?? "",
          urlOrContent: d.urlOrContent,
        })) ?? [],
        statusHistory: task.statusHistory.map((h) => ({
          fromStatus: h.fromStatus as TaskStatus | null,
          toStatus: h.toStatus as TaskStatus,
          changedAt: h.changedAt instanceof Date ? h.changedAt.toISOString() : String(h.changedAt),
        })),
        comments: task.comments.map((c) => ({
          id: c.id,
          authorName: c.author?.name || c.author?.email || "User",
          content: c.content,
          createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : String(c.createdAt),
        })),
        agent: {
          runs: (task.agentRuns || []).map((r) => ({
            ...r,
            startedAt: r.startedAt instanceof Date ? r.startedAt.toISOString() : String(r.startedAt),
            endedAt: r.endedAt ? (r.endedAt instanceof Date ? r.endedAt.toISOString() : String(r.endedAt)) : null,
            usageEvents: (r.usageEvents || []).map((u) => ({
              ...u,
              createdAt: u.createdAt instanceof Date ? u.createdAt.toISOString() : String(u.createdAt),
            })),
          })),
          checkpoints: (task.checkpoints || []).map((cp) => ({
            ...cp,
            createdAt: cp.createdAt instanceof Date ? cp.createdAt.toISOString() : String(cp.createdAt),
          })),
        },
      },
    };
  } catch (err: any) {
    return { success: false, error: { code: "INTERNAL", message: err?.message || "Failed to load task details." } };
  }
}

export async function resetAllTasksAction(): Promise<ActionResult<Partial<CharacterSheetData>>> {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  if (!user) {
    return { success: false, error: { code: "NOT_FOUND", message: "User not found." } };
  }

  try {
    // Delete all user data in a single atomic transaction
    await db.$transaction(async (tx) => {
      await tx.taskStatusLog.deleteMany({ where: { task: { ownerId: user.id } } });
      await tx.comment.deleteMany({ where: { task: { ownerId: user.id } } });
      await tx.activityLog.deleteMany({ where: { actorId: user.id } });
      await tx.workSession.deleteMany({ where: { task: { ownerId: user.id } } });
      await tx.task.deleteMany({ where: { ownerId: user.id } });
      await tx.project.deleteMany({ where: { ownerId: user.id } });
      // New relational models
      await tx.taskRelation.deleteMany({ where: { task: { ownerId: user.id } } });
      await tx.attachment.deleteMany({ where: { task: { ownerId: user.id } } });
      await tx.deliverable.deleteMany({ where: { task: { ownerId: user.id } } });
      await tx.taskTag.deleteMany({ where: { task: { ownerId: user.id } } });
      await tx.xpLog.deleteMany({ where: { userId: user.id } });
      await tx.achievement.deleteMany({ where: { unlockedAt: { not: null } } }); // only reset unlocked
      await tx.setting.deleteMany({ where: { userId: user.id } });
    });

    // Seed initial data
    await seedInitialData(user.id);

    let sheetData: CharacterSheetData | undefined;
    try {
      sheetData = await getCharacterSheetData(user.id);
    } catch (sheetErr) {
      console.error("Failed to compute character sheet after reset:", sheetErr);
    }

    return {
      success: true,
      data: sheetData ?? {},
    };
  } catch (error) {
    console.error("Failed to reset all data:", error);
    return { success: false, error: { code: "INTERNAL", message: "Failed to reset data." } };
  }
}
