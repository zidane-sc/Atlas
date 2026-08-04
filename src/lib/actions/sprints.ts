"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createSprintSchema, updateSprintSchema } from "@/lib/schemas/sprint";
import { type Sprint, type SprintStatus } from "@/generated/prisma/client";
import type { ActionResult } from "@/lib/actions/types";
import { logActivity } from "@/lib/actions/activity";

type SprintWithProjects = Sprint & { projects: { id: string }[] };

const PROJECTS_INCLUDE = { projects: { select: { id: true } } } as const;

export async function createSprint(input: unknown): Promise<ActionResult<SprintWithProjects>> {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
  }

  const parsed = createSprintSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid input." },
    };
  }

  const owner = await db.user.findFirst({ where: { email: session.user.email } });
  if (!owner) {
    return { success: false, error: { code: "NOT_FOUND", message: "User not found." } };
  }

  if (parsed.data.projectIds.length > 0) {
    const count = await db.project.count({ where: { id: { in: parsed.data.projectIds }, ownerId: owner.id } });
    if (count !== parsed.data.projectIds.length) {
      return { success: false, error: { code: "NOT_FOUND", message: "Project not found." } };
    }
  }

  try {
    const sprint = await db.$transaction(async (tx) => {
      const created = await tx.sprint.create({
        data: {
          ownerId: owner.id,
          name: parsed.data.name,
          projects: { connect: parsed.data.projectIds.map((id) => ({ id })) },
          startDate: new Date(parsed.data.startDate),
          endDate: new Date(parsed.data.endDate),
          status: parsed.data.status as SprintStatus,
          goal: parsed.data.goal || null,
        },
        include: PROJECTS_INCLUDE,
      });

      await logActivity(tx, owner.id, {
        sprintId: created.id,
        action: "created",
        details: { name: created.name },
      });

      return created;
    });

    return { success: true, data: sprint };
  } catch {
    return { success: false, error: { code: "INTERNAL", message: "Failed to create sprint." } };
  }
}

export async function updateSprint(id: string, input: unknown): Promise<ActionResult<SprintWithProjects>> {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
  }

  const parsed = updateSprintSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid input." },
    };
  }

  const owner = await db.user.findFirst({ where: { email: session.user.email } });
  if (!owner) {
    return { success: false, error: { code: "NOT_FOUND", message: "User not found." } };
  }

  const existing = await db.sprint.findFirst({ where: { id, ownerId: owner.id } });
  if (!existing) {
    return { success: false, error: { code: "NOT_FOUND", message: "Sprint not found." } };
  }

  if (parsed.data.projectIds && parsed.data.projectIds.length > 0) {
    const count = await db.project.count({ where: { id: { in: parsed.data.projectIds }, ownerId: owner.id } });
    if (count !== parsed.data.projectIds.length) {
      return { success: false, error: { code: "NOT_FOUND", message: "Project not found." } };
    }
  }

  try {
    const sprint = await db.$transaction(async (tx) => {
      const updated = await tx.sprint.update({
        where: { id, ownerId: owner.id },
        data: {
          name: parsed.data.name,
          projects: parsed.data.projectIds ? { set: parsed.data.projectIds.map((id) => ({ id })) } : undefined,
          startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : undefined,
          endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : undefined,
          status: parsed.data.status ? (parsed.data.status as SprintStatus) : undefined,
          goal: parsed.data.goal === null ? null : parsed.data.goal,
        },
        include: PROJECTS_INCLUDE,
      });

      await logActivity(tx, owner.id, {
        sprintId: updated.id,
        action: "updated",
        details: { name: updated.name },
      });

      return updated;
    });

    return { success: true, data: sprint };
  } catch {
    return { success: false, error: { code: "INTERNAL", message: "Failed to update sprint." } };
  }
}

export async function deleteSprint(id: string): Promise<ActionResult<{ id: string }>> {
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
      const existing = await tx.sprint.findFirst({ where: { id, ownerId: owner.id } });
      if (!existing) {
        throw new Error("NOT_FOUND");
      }

      await tx.sprint.delete({ where: { id, ownerId: owner.id } });

      await logActivity(tx, owner.id, {
        sprintId: id,
        action: "deleted",
        details: { name: existing.name },
      });
    });

    return { success: true, data: { id } };
  } catch {
    return { success: false, error: { code: "NOT_FOUND", message: "Sprint not found." } };
  }
}
