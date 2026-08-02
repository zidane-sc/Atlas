"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import type { TaskFilters } from "@/lib/task-filters";
import type { ActionResult } from "@/lib/actions/types";
import { z } from "zod";

const taskFiltersSchema = z.object({
  statuses: z.array(z.string()),
  statusOp: z.enum(["is", "is_not"]),
  priorities: z.array(z.string()),
  priorityOp: z.enum(["any", "gte", "lte"]),
  projects: z.array(z.string()),
  types: z.array(z.string()),
  tags: z.array(z.string()),
  query: z.string(),
  combineMode: z.enum(["AND", "OR"]),
});

const saveFilterInputSchema = z.object({
  name: z.string().min(1, "Name must be at least 1 character long."),
  filters: taskFiltersSchema,
});

export interface SavedFilterClient {
  id: string;
  name: string;
  filters: TaskFilters;
}

export async function saveFilterAction(
  name: string,
  filters: TaskFilters
): Promise<ActionResult<SavedFilterClient[]>> {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
  }

  const parsed = saveFilterInputSchema.safeParse({ name, filters });
  if (!parsed.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid input." },
    };
  }

  try {
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, savedFilters: true },
    });

    if (!user) {
      return { success: false, error: { code: "NOT_FOUND", message: "User not found." } };
    }

    const currentFilters = (user.savedFilters as unknown as SavedFilterClient[]) || [];
    
    // Check if name is already taken
    if (currentFilters.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
      return { success: false, error: { code: "CONFLICT", message: "A saved filter with this name already exists." } };
    }

    const newFilter: SavedFilterClient = {
      id: crypto.randomUUID(),
      name,
      filters,
    };

    const updatedFilters = [...currentFilters, newFilter];

    await db.user.update({
      where: { id: user.id },
      data: {
        savedFilters: updatedFilters as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      success: true,
      data: updatedFilters,
    };
  } catch (error) {
    console.error("Failed to save filter:", error);
    return { success: false, error: { code: "INTERNAL", message: "Failed to save filter." } };
  }
}

export async function deleteFilterAction(id: string): Promise<ActionResult<SavedFilterClient[]>> {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
  }

  try {
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, savedFilters: true },
    });

    if (!user) {
      return { success: false, error: { code: "NOT_FOUND", message: "User not found." } };
    }

    const currentFilters = (user.savedFilters as unknown as SavedFilterClient[]) || [];
    const updatedFilters = currentFilters.filter((f) => f.id !== id);

    await db.user.update({
      where: { id: user.id },
      data: {
        savedFilters: updatedFilters as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      success: true,
      data: updatedFilters,
    };
  } catch (error) {
    console.error("Failed to delete filter:", error);
    return { success: false, error: { code: "INTERNAL", message: "Failed to delete filter." } };
  }
}
