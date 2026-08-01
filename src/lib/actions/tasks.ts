"use server";

import { auth } from "@/lib/auth";
import { logActivity } from "@/lib/actions/activity";
import { db } from "@/lib/db";
import { createTaskSchema, updateTaskSchema } from "@/lib/schemas/task";
import { Prisma, type Task } from "@/generated/prisma/client";
import type { ActionResult } from "@/lib/actions/types";
import { calcTaskXP, isTaskOnTime } from "@/lib/gamification";
import { generateTaskCode, getNextTaskCodeNumber } from "@/lib/task-code";

function toDate(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Date(value);
}


export async function createTask(input: unknown): Promise<ActionResult<Task>> {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
  }

  const parsed = createTaskSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid input." },
    };
  }

  // owner_id defaults to the sole user (docs/02-architecture.md §4.4) — resolved from the
  // session, never trusted from client input. No Auth.js adapter persists this on sign-in
  // (JWT sessions, docs/02-architecture.md §6), so upsert it here instead.
  const owner = await db.user.upsert({
    where: { email: session.user.email },
    update: {},
    create: { email: session.user.email, name: session.user.name ?? session.user.email },
  });

  const { startDate, dueDate, ...rest } = parsed.data;

  try {
    const task = await db.$transaction(async (tx) => {
      // Get project to find its code
      const project = rest.projectId
        ? await tx.project.findUnique({ where: { id: rest.projectId }, select: { code: true } })
        : null;

      // Generate task code if project exists and has a code
      let taskCode = null;
      if (project?.code) {
        const nextNumber = await getNextTaskCodeNumber(tx, owner.id);
        taskCode = generateTaskCode(project.code, nextNumber);
      }

      const created = await tx.task.create({
        data: {
          ...rest,
          code: taskCode,
          ownerId: owner.id,
          startDate: startDate ? new Date(startDate) : undefined,
          dueDate: dueDate ? new Date(dueDate) : undefined,
        },
      });

      await tx.taskStatusLog.create({
        data: {
          taskId: created.id,
          fromStatus: null,
          toStatus: created.status,
        },
      });

      await logActivity(tx, owner.id, {
        taskId: created.id,
        action: "created",
        details: { title: created.title },
      });

      return created;
    });
    return { success: true, data: task };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      return { success: false, error: { code: "NOT_FOUND", message: "Parent task not found." } };
    }
    return { success: false, error: { code: "INTERNAL", message: "Failed to create task." } };
  }
}

export async function updateTask(id: string, input: unknown): Promise<ActionResult<Task>> {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
  }

  const parsed = updateTaskSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid input." },
    };
  }

  if (parsed.data.parentId === id) {
    return { success: false, error: { code: "VALIDATION_ERROR", message: "A task cannot be its own parent." } };
  }

  const owner = await db.user.findFirst({ where: { email: session.user.email } });
  if (!owner) {
    return { success: false, error: { code: "NOT_FOUND", message: "User not found." } };
  }

  // Soft-deleted tasks (docs/02-architecture.md §4.4 `deleted_at`) are gone as far as edits are concerned.
  const existing = await db.task.findFirst({ where: { id, deletedAt: null } });
  if (!existing) {
    return { success: false, error: { code: "NOT_FOUND", message: "Task not found." } };
  }

  const { startDate, dueDate, status, ...rest } = parsed.data;

  // completed_at is set when status → done, and cleared when a done task is reopened —
  // docs/02-architecture.md §4.4 note on that column.
  let completedAt: Date | null | undefined;
  if (status && status !== existing.status && status === "done") {
    completedAt = new Date();
  } else if (status && status !== existing.status && existing.status === "done") {
    completedAt = null;
  }

  try {
    const task = await db.$transaction(async (tx) => {
      const updated = await tx.task.update({
        where: { id },
        data: {
          ...rest,
          status,
          completedAt,
          startDate: toDate(startDate),
          dueDate: toDate(dueDate),
        },
      });

      const changes: Record<string, { from: any; to: any }> = {};

      if (status && status !== existing.status) {
        changes.status = { from: existing.status, to: updated.status };
        await tx.taskStatusLog.create({
          data: {
            taskId: updated.id,
            fromStatus: existing.status,
            toStatus: updated.status,
          },
        });

        // Award XP when task completes
        if (updated.status === "done") {
          const xpEarned = calcTaskXP(
            updated.priority,
            updated.storyPoint ?? undefined,
            isTaskOnTime(updated as any)
          );

          const currentUser = await tx.user.findUnique({
            where: { id: owner.id },
            select: { bonusXp: true },
          });

          await tx.user.update({
            where: { id: owner.id },
            data: {
              bonusXp: (currentUser?.bonusXp ?? 0) + xpEarned,
            },
          });
        }
      }

      if (parsed.data.priority && parsed.data.priority !== existing.priority) {
        changes.priority = { from: existing.priority, to: parsed.data.priority };
      }
      if (parsed.data.effort && parsed.data.effort !== existing.effort) {
        changes.effort = { from: existing.effort, to: parsed.data.effort };
      }
      if (parsed.data.storyPoint && parsed.data.storyPoint !== existing.storyPoint) {
        changes.storyPoint = { from: existing.storyPoint, to: parsed.data.storyPoint };
      }
      if (parsed.data.title && parsed.data.title !== existing.title) {
        changes.title = { from: existing.title, to: parsed.data.title };
      }

      const action = status === "done" ? "completed" : (Object.keys(changes).length > 0 ? "updated" : "updated");
      await logActivity(tx, owner.id, {
        taskId: updated.id,
        action,
        details: { changes, title: updated.title },
      });

      return updated;
    });
    return { success: true, data: task };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      return { success: false, error: { code: "NOT_FOUND", message: "Parent task not found." } };
    }
    return { success: false, error: { code: "INTERNAL", message: "Failed to update task." } };
  }
}

export async function deleteTask(id: string): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
  }

  const owner = await db.user.findFirst({ where: { email: session.user.email } });
  if (!owner) {
    return { success: false, error: { code: "NOT_FOUND", message: "User not found." } };
  }

  try {
    await db.$transaction(async (tx) => {
      const existing = await tx.task.findFirst({ where: { id, deletedAt: null } });
      if (!existing) {
        throw new Error("NOT_FOUND");
      }

      await tx.task.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      await logActivity(tx, owner.id, {
        taskId: id,
        action: "deleted",
        details: { title: existing.title },
      });
    });

    return { success: true, data: { id } };
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return { success: false, error: { code: "NOT_FOUND", message: "Task not found." } };
    }
    return { success: false, error: { code: "INTERNAL", message: "Failed to delete task." } };
  }
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

  const owner = await db.user.findFirst({ where: { email: session.user.email } });
  if (!owner) {
    return { success: false, error: { code: "NOT_FOUND", message: "User not found." } };
  }

  try {
    const updatedTask = await db.$transaction(async (tx) => {
      const task = await tx.task.findUnique({ where: { id: taskId } });
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
      });

      const updated = await tx.task.update({
        where: { id: taskId },
        data: {
          timeSpentSeconds: task.timeSpentSeconds + durationSeconds,
        },
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

export async function startFocusTimerAction(taskId: string, phase: "focus" | "break" = "focus"): Promise<ActionResult<{ success: boolean }>> {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
  }

  try {
    await db.user.update({
      where: { email: session.user.email },
      data: {
        activeTimerTaskId: taskId,
        activeTimerStartedAt: new Date(),
        activeTimerPhase: phase,
      },
    });
    return { success: true, data: { success: true } };
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
      select: { activeTimerTaskId: true, activeTimerStartedAt: true, activeTimerPhase: true },
    });

    if (!user || !user.activeTimerTaskId || !user.activeTimerStartedAt) {
      return { success: false, error: { code: "NOT_FOUND", message: "No active focus timer found." } };
    }

    const taskId = user.activeTimerTaskId;
    const startedAt = user.activeTimerStartedAt;
    const phase = user.activeTimerPhase;
    const endedAt = new Date();
    const seconds = Math.max(1, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000));

    // Clear active timer fields on user
    await db.user.update({
      where: { email: session.user.email },
      data: {
        activeTimerTaskId: null,
        activeTimerStartedAt: null,
        activeTimerPhase: "focus",
      },
    });

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
