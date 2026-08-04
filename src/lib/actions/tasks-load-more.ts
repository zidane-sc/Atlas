"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { mapDbTaskToClient } from "@/lib/tasks-reducer";
import type { Task } from "@/types/task";
import type { ActionResult } from "./types";

export async function loadMoreTasks({
  cursor,
  limit = 100,
}: {
  cursor: string;
  limit?: number;
}): Promise<ActionResult<Task[]>> {
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

    const projects = await db.project.findMany({
      where: { ownerId: user.id, archivedAt: null },
    });

    const sprints = await db.sprint.findMany({
      where: { ownerId: user.id },
    });

    // No nested statusHistory/comments — on-demand only via `getTaskDetails`, same as the
    // main bulk fetch in layout.tsx (docs/05-backlog.md §8 finding #16).
    const tasks = await db.task.findMany({
      where: { ownerId: user.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: 1,
      cursor: { id: cursor },
    });

    return {
      success: true,
      data: tasks.map((t) => mapDbTaskToClient(t, projects, sprints)),
    };
  } catch (error) {
    console.error("Failed to load more tasks:", error);
    return { success: false, error: { code: "INTERNAL", message: "Failed to load more tasks." } };
  }
}
