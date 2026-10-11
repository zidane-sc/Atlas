import { db } from "@/lib/db";
import { createTaskSchema, updateTaskSchema, type CreateTaskInput, type UpdateTaskInput } from "@/lib/schemas/task";
import { generateTaskCode, getNextTaskCodeNumber } from "@/lib/task-code";
import { logActivity } from "@/lib/actions/activity";
import { broadcastSyncEvent } from "@/lib/sync-events";
import { getCharacterSheetData, type CharacterSheetData } from "@/lib/character-sheet-data";
import type { ActionResult } from "@/lib/actions/types";
import type { Task } from "@/generated/prisma/client";

function toDate(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (value === "") return undefined;
  return new Date(value);
}

export interface DomainTaskResult {
  task: Task;
  sheetData?: CharacterSheetData;
}

export async function domainCreateTask(
  ownerId: string,
  input: unknown
): Promise<ActionResult<DomainTaskResult>> {
  const parsed = createTaskSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid input." },
    };
  }

  if (parsed.data.relations?.some((r) => r.taskId === "SELF")) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "A task cannot be related to itself." },
    };
  }

  const { startDate, dueDate, waitingReason, metadata, ...rest } = parsed.data;

  const MAX_CODE_COLLISION_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_CODE_COLLISION_RETRIES; attempt++) {
    try {
      const task = await db.$transaction(async (tx) => {
        const project = rest.projectId
          ? await tx.project.findFirst({ where: { id: rest.projectId, ownerId }, select: { code: true } })
          : null;

        const codePrefix = project?.code || "TASK";
        const nextNumber = await getNextTaskCodeNumber(tx, ownerId, codePrefix);
        const taskCode = generateTaskCode(codePrefix, nextNumber);

        const created = await tx.task.create({
          data: {
            ...rest,
            code: taskCode,
            ownerId,
            startDate: startDate ? new Date(startDate) : undefined,
            dueDate: dueDate ? new Date(dueDate) : undefined,
            waitingReason: waitingReason || undefined,
            metadata: metadata || undefined,
            tags: rest.tags?.map((name: string) => ({
              create: {
                tag: {
                  connectOrCreate: {
                    where: { name },
                    create: { name },
                  },
                },
              },
            })) as any,
            relations: (rest.relations ?? []).length > 0 ? {
              create: (rest.relations ?? []).map((r) => ({
                relationType: r.relationType as any,
                relatedTask: { connect: { id: r.taskId } },
              })),
            } : undefined,
            attachments: {
              create: (rest.attachments ?? []).map((a) => ({
                type: a.type as any,
                url: a.url,
                label: a.label,
              })),
            },
            deliverables: {
              create: (rest.deliverables ?? []).map((d) => ({
                type: d.type as any,
                urlOrContent: d.urlOrContent ?? "",
              })),
            },
          },
        });

        await tx.taskStatusLog.create({
          data: {
            taskId: created.id,
            fromStatus: null,
            toStatus: created.status,
          },
          select: { id: true },
        });

        await logActivity(tx, ownerId, {
          taskId: created.id,
          action: "created",
          details: { title: created.title, code: created.code },
        });

        return created;
      });

      broadcastSyncEvent(ownerId, "task:created", { id: task.id, title: task.title });

      let sheetData: CharacterSheetData | undefined;
      if (rest.status === "done") {
        try {
          sheetData = await getCharacterSheetData(ownerId);
        } catch {
          // Non-fatal
        }
      }

      return { success: true, data: { task, sheetData } };
    } catch (err: any) {
      if (err?.code === "P2002" && attempt < MAX_CODE_COLLISION_RETRIES) {
        continue;
      }
      return { success: false, error: { code: "INTERNAL", message: err?.message ?? "Failed to create task." } };
    }
  }

  return { success: false, error: { code: "INTERNAL", message: "Failed to allocate unique task code." } };
}

export async function domainUpdateTask(
  ownerId: string,
  id: string,
  input: unknown
): Promise<ActionResult<DomainTaskResult>> {
  const parsed = updateTaskSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid input." },
    };
  }

  const { startDate, dueDate, status, waitingReason, metadata, tags, relations, attachments, deliverables, pinned, ...rest } = parsed.data;

  try {
    const { task, affectsGamification } = await db.$transaction(async (tx) => {
      const existing = await tx.task.findFirst({
        where: { id, ownerId, deletedAt: null },
        select: {
          status: true,
          priority: true,
          size: true,
          title: true,
          type: true,
        },
      });
      if (!existing) {
        throw new Error("NOT_FOUND");
      }

      let completedAt: Date | null | undefined;
      if (status && status !== existing.status && status === "done") {
        completedAt = new Date();
      } else if (status && status !== existing.status && existing.status === "done") {
        completedAt = null;
      }

      const updated = await tx.task.update({
        where: { id, ownerId },
        data: {
          ...rest,
          status,
          pinned,
          completedAt,
          startDate: toDate(startDate),
          dueDate: toDate(dueDate),
          waitingReason: waitingReason !== undefined ? waitingReason : undefined,
          metadata: metadata !== undefined ? (metadata as any) : undefined,
          tags: tags ? {
            deleteMany: {},
            create: tags.map((name: string) => ({
              tag: {
                connectOrCreate: {
                  where: { name },
                  create: { name },
                },
              },
            })),
          } : undefined,
          relations: relations ? {
            deleteMany: {},
            create: relations.map((r) => ({
              relationType: r.relationType as any,
              relatedTask: { connect: { id: r.taskId } },
            })),
          } : undefined,
          attachments: attachments ? {
            deleteMany: {},
            create: attachments.map((a) => ({
              type: a.type as any,
              url: a.url,
              label: a.label,
            })),
          } : undefined,
          deliverables: deliverables ? {
            deleteMany: {},
            create: deliverables.map((d) => ({
              type: d.type as any,
              urlOrContent: d.urlOrContent ?? "",
            })),
          } : undefined,
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
          select: { id: true },
        });
      }

      if (parsed.data.priority && parsed.data.priority !== existing.priority) {
        changes.priority = { from: existing.priority, to: parsed.data.priority };
      }
      if (parsed.data.size && parsed.data.size !== existing.size) {
        changes.size = { from: existing.size, to: parsed.data.size };
      }
      if (parsed.data.title && parsed.data.title !== existing.title) {
        changes.title = { from: existing.title, to: parsed.data.title };
      }

      const action = status === "done" ? "completed" : "updated";
      await logActivity(tx, ownerId, {
        taskId: updated.id,
        action,
        details: { changes, title: updated.title },
      });

      const affectsGamification =
        (status !== undefined && status !== existing.status && (status === "done" || existing.status === "done")) ||
        (existing.status === "done" && (
          (parsed.data.priority !== undefined && parsed.data.priority !== existing.priority) ||
          (parsed.data.type !== undefined && parsed.data.type !== existing.type)
        ));

      return { task: updated, affectsGamification };
    });

    let sheetData: CharacterSheetData | undefined;
    if (affectsGamification) {
      try {
        sheetData = await getCharacterSheetData(ownerId);
      } catch {
        // Non-fatal
      }
    }

    broadcastSyncEvent(ownerId, "task:updated", { id: task.id, title: task.title, status: task.status });

    return { success: true, data: { task, sheetData } };
  } catch (err: any) {
    if (err?.message === "NOT_FOUND") {
      return { success: false, error: { code: "NOT_FOUND", message: "Task not found." } };
    }
    return { success: false, error: { code: "INTERNAL", message: err?.message ?? "Failed to update task." } };
  }
}
