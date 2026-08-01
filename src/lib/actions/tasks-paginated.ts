"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { mapDbTaskToClient } from "@/lib/tasks-reducer";
import type { Project } from "@/types/project";
import type { Sprint } from "@/types/sprint";
import type { Task } from "@/types/task";
import type { ActionResult } from "./types";

export async function listTasksPaginated({
  cursor,
  limit = 100,
  includeComments = false,
}: {
  cursor?: string;
  limit?: number;
  includeComments?: boolean;
}): Promise<
  ActionResult<{
    tasks: Task[];
    nextCursor?: string;
    hasMore: boolean;
  }>
> {
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
      where: { archivedAt: null },
      orderBy: { createdAt: "asc" },
    });

    const sprints = await db.sprint.findMany({
      orderBy: { startDate: "asc" },
    });

    const tasks = await db.task.findMany({
      where: { ownerId: user.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      include: {
        statusHistory: {
          orderBy: { changedAt: "asc" },
          take: 50,
        },
        comments: includeComments
          ? {
              orderBy: { createdAt: "asc" },
              take: 20,
              include: { author: true },
            }
          : false,
      },
    });

    const hasMore = tasks.length > limit;
    const pageOfTasks = hasMore ? tasks.slice(0, -1) : tasks;
    const nextCursor = hasMore ? pageOfTasks[pageOfTasks.length - 1]?.id : undefined;

    const projectMap = new Map(projects.map((p) => [p.name, p]));
    const sprintMap = new Map(sprints.map((s) => [s.id, s]));

    const clientTasks = pageOfTasks.map((t) =>
      mapDbTaskToClient(t, projects, sprints)
    );

    return {
      success: true,
      data: {
        tasks: clientTasks,
        nextCursor,
        hasMore,
      },
    };
  } catch (error) {
    console.error("Failed to fetch tasks paginated:", error);
    return { success: false, error: { code: "INTERNAL", message: "Failed to fetch tasks." } };
  }
}
