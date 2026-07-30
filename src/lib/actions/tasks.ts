"use server";

import { auth } from "@/lib/auth";
import { logActivity } from "@/lib/actions/activity";
import { db } from "@/lib/db";
import { createTaskSchema, updateTaskSchema } from "@/lib/schemas/task";
import { Prisma, type Task } from "@/generated/prisma/client";
import type { ActionResult } from "@/lib/actions/types";

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
      const created = await tx.task.create({
        data: {
          ...rest,
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

      if (status && status !== existing.status) {
        await tx.taskStatusLog.create({
          data: {
            taskId: updated.id,
            fromStatus: existing.status,
            toStatus: updated.status,
          },
        });

        await logActivity(tx, owner.id, {
          taskId: updated.id,
          action: status === "done" ? "completed" : "status_changed",
          details: { from: existing.status, to: updated.status, title: updated.title },
        });
      } else {
        await logActivity(tx, owner.id, {
          taskId: updated.id,
          action: "updated",
          details: { title: updated.title },
        });
      }

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
