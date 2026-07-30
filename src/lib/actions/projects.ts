"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createProjectSchema, updateProjectSchema, toDbProjectCategory } from "@/lib/schemas/project";
import { type Project, type ProjectCategory, type ProjectStatus } from "@/generated/prisma/client";
import type { ActionResult } from "@/lib/actions/types";
import { logActivity } from "@/lib/actions/activity";

export async function createProject(input: unknown): Promise<ActionResult<Project>> {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
  }

  const parsed = createProjectSchema.safeParse(input);
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

  try {
    const project = await db.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          ...parsed.data,
          status: parsed.data.status as ProjectStatus,
          category: toDbProjectCategory(parsed.data.category) as ProjectCategory,
        },
      });

      await logActivity(tx, owner.id, {
        projectId: created.id,
        action: "created",
        details: { name: created.name },
      });

      return created;
    });

    return { success: true, data: project };
  } catch {
    return { success: false, error: { code: "INTERNAL", message: "Failed to create project." } };
  }
}

export async function updateProject(id: string, input: unknown): Promise<ActionResult<Project>> {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
  }

  const parsed = updateProjectSchema.safeParse(input);
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

  const existing = await db.project.findFirst({ where: { id, archivedAt: null } });
  if (!existing) {
    return { success: false, error: { code: "NOT_FOUND", message: "Project not found." } };
  }

  try {
    const project = await db.$transaction(async (tx) => {
      const updated = await tx.project.update({
        where: { id },
        data: {
          ...parsed.data,
          category: parsed.data.category ? (toDbProjectCategory(parsed.data.category) as ProjectCategory) : undefined,
          status: parsed.data.status ? (parsed.data.status as ProjectStatus) : undefined,
          description: parsed.data.description === null ? null : parsed.data.description,
        },
      });

      await logActivity(tx, owner.id, {
        projectId: updated.id,
        action: "updated",
        details: { name: updated.name },
      });

      return updated;
    });

    return { success: true, data: project };
  } catch {
    return { success: false, error: { code: "INTERNAL", message: "Failed to update project." } };
  }
}

export async function deleteProject(id: string): Promise<ActionResult<{ id: string }>> {
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
      const existing = await tx.project.findFirst({ where: { id, archivedAt: null } });
      if (!existing) {
        throw new Error("NOT_FOUND");
      }

      await tx.project.update({
        where: { id },
        data: { archivedAt: new Date() },
      });

      await logActivity(tx, owner.id, {
        projectId: id,
        action: "deleted",
        details: { name: existing.name },
      });
    });

    return { success: true, data: { id } };
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return { success: false, error: { code: "NOT_FOUND", message: "Project not found." } };
    }
    return { success: false, error: { code: "INTERNAL", message: "Failed to delete project." } };
  }
}
