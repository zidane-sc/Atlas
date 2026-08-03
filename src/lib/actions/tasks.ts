"use server";

import { auth } from "@/lib/auth";
import { logActivity } from "@/lib/actions/activity";
import { db } from "@/lib/db";
import { createTaskSchema, updateTaskSchema } from "@/lib/schemas/task";
import { Prisma, type Task } from "@/generated/prisma/client";
import type { ActionResult } from "@/lib/actions/types";
import { generateTaskCode, getNextTaskCodeNumber } from "@/lib/task-code";
import type { TaskComment, TaskStatus, TaskStatusLogEntry } from "@/types/task";
import { getCharacterSheetData, type CharacterSheetData } from "@/lib/character-sheet-data";
import { seedInitialData } from "@/lib/seeders/initial-data";

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

  // Two concurrent creates can read the same "last task" and compute the same next code
  // number — the DB's `@@unique([ownerId, code])` rejects the second one (P2002), which used
  // to surface as an opaque "Failed to create task." with no retry (docs/05-backlog.md §8
  // finding #6). Retry a few times, recomputing the code number fresh each attempt, before
  // giving up — self-heals the collision instead of losing the create.
  const MAX_CODE_COLLISION_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_CODE_COLLISION_RETRIES; attempt++) {
    try {
      const task = await db.$transaction(async (tx) => {
        // Get project to find its code
        const project = rest.projectId
          ? await tx.project.findUnique({ where: { id: rest.projectId }, select: { code: true } })
          : null;

        // Generate task code with project code or default TASK prefix
        const nextNumber = await getNextTaskCodeNumber(tx, owner.id);
        const codePrefix = project?.code || "TASK";
        const taskCode = generateTaskCode(codePrefix, nextNumber);

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
      let sheetData: CharacterSheetData | undefined;
      try {
        sheetData = await getCharacterSheetData(owner.id);
      } catch (sheetErr) {
        console.error("Failed to compute character sheet after task create:", sheetErr);
      }
      return { success: true, data: { task, ...sheetData } };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
        return { success: false, error: { code: "NOT_FOUND", message: "Related project or sprint not found." } };
      }
      const isCodeCollision =
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002" &&
        Array.isArray((err.meta as { target?: unknown })?.target) &&
        (err.meta as { target: string[] }).target.includes("code");
      if (isCodeCollision && attempt < MAX_CODE_COLLISION_RETRIES) {
        continue;
      }
      return { success: false, error: { code: "INTERNAL", message: "Failed to create task." } };
    }
  }
  return { success: false, error: { code: "INTERNAL", message: "Failed to create task." } };
}

export async function updateTask(
  id: string,
  input: unknown
): Promise<ActionResult<{ task: Task } & Partial<CharacterSheetData>>> {
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

  // Client-side filters a task out of its own relation picker (TaskFormSheet), but that's not
  // enforced server-side — a direct action call could still make a task relate to itself
  // (docs/05-backlog.md §8 finding #5).
  if (parsed.data.relations?.some((r) => r.taskId === id)) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "A task cannot be related to itself." },
    };
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

    let sheetData: CharacterSheetData | undefined;
    try {
      sheetData = await getCharacterSheetData(owner.id);
    } catch (sheetErr) {
      console.error("Failed to compute character sheet after task update:", sheetErr);
    }
    return { success: true, data: { task, ...sheetData } };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      return { success: false, error: { code: "NOT_FOUND", message: "Related project or sprint not found." } };
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

export async function restoreTask(id: string): Promise<ActionResult<{ id: string }>> {
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
      const existing = await tx.task.findFirst({ where: { id, ownerId: owner.id, deletedAt: { not: null } } });
      if (!existing) {
        throw new Error("NOT_FOUND");
      }

      await tx.task.update({
        where: { id },
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

  const owner = await db.user.findFirst({ where: { email: session.user.email } });
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

/**
 * On-demand full status history + comments for one task — the bulk task fetch (layout.tsx)
 * no longer includes either, for performance (docs/05-backlog.md §8 finding #16). Called when
 * TaskFormSheet opens an existing task, since that's the only place either is displayed.
 */
export async function getTaskDetails(
  taskId: string
): Promise<ActionResult<{ statusHistory: TaskStatusLogEntry[]; comments: TaskComment[] }>> {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
  }

  const task = await db.task.findFirst({
    where: { id: taskId, owner: { email: session.user.email } },
    select: {
      statusHistory: { orderBy: { changedAt: "asc" } },
      comments: { orderBy: { createdAt: "asc" }, include: { author: true } },
    },
  });

  if (!task) {
    return { success: false, error: { code: "NOT_FOUND", message: "Task not found." } };
  }

  return {
    success: true,
    data: {
      statusHistory: task.statusHistory.map((h) => ({
        fromStatus: h.fromStatus as TaskStatus | null,
        toStatus: h.toStatus as TaskStatus,
        changedAt: h.changedAt.toISOString(),
      })),
      comments: task.comments.map((c) => ({
        id: c.id,
        authorName: c.author.name || c.author.email,
        content: c.content,
        createdAt: c.createdAt.toISOString(),
      })),
    },
  };
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
    // Delete all data
    await Promise.all([
      db.task.deleteMany({ where: { ownerId: user.id } }),
      db.project.deleteMany({ where: {} }),
      db.sprint.deleteMany({ where: {} }),
      db.note.deleteMany({ where: { userId: user.id } }),
    ]);

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
