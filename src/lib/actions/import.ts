"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Task } from "@/types/task";
import type { Project, Sprint } from "@/types/gamification";
import type { ActionResult } from "@/lib/actions/types";
import { toDbProjectCategory } from "@/lib/schemas/project";
import { Prisma } from "@/generated/prisma/client";
import type { ProjectCategory, ProjectStatus, SprintStatus, TaskStatus, TaskType, TaskPriority, TaskEffort, TaskReporter } from "@/generated/prisma/client";

interface ImportPayload {
  tasks: Task[];
  projects: Project[];
  sprints: Sprint[];
  bonus: { xp: number; coins: number };
}

export async function importWorkspaceData(
  payload: ImportPayload
): Promise<ActionResult<{ success: boolean }>> {
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

    const { tasks, projects, sprints, bonus } = payload;

    await db.$transaction(async (tx) => {
      // 1. Wipe existing data
      await tx.taskStatusLog.deleteMany({});
      await tx.comment.deleteMany({});
      await tx.activityLog.deleteMany({});
      await tx.workSession.deleteMany({});
      await tx.task.deleteMany({});
      await tx.project.deleteMany({});
      await tx.sprint.deleteMany({});

      // 2. Insert Projects
      if (projects.length > 0) {
        await tx.project.createMany({
          data: projects.map((p) => ({
            id: p.id,
            name: p.name,
            category: toDbProjectCategory(p.category) as ProjectCategory,
            colorVar: p.colorVar,
            emoji: p.emoji,
            description: p.description || null,
            status: p.status as ProjectStatus,
          })),
        });
      }

      // 3. Insert Sprints
      if (sprints.length > 0) {
        await tx.sprint.createMany({
          data: sprints.map((s) => ({
            id: s.id,
            name: s.name,
            startDate: new Date(s.startDate),
            endDate: new Date(s.endDate),
            status: s.status as SprintStatus,
            goal: s.goal || null,
          })),
        });
      }

      // 4. Insert Tasks & nested items
      for (const t of tasks) {
        // Resolve project and sprint IDs by name if they exist
        let projectId: string | null = null;
        if (t.project) {
          const prj = projects.find((p) => p.name === t.project);
          if (prj) projectId = prj.id;
        }

        let sprintId: string | null = null;
        if (t.sprint) {
          const spr = sprints.find((s) => s.name === t.sprint);
          if (spr) sprintId = spr.id;
        }

        await tx.task.create({
          data: {
            id: t.id,
            title: t.title,
            description: t.description || null,
            projectId,
            sprintId,
            status: t.status as TaskStatus,
            type: t.type as TaskType,
            priority: t.priority as TaskPriority,
            effort: t.effort ? (t.effort as TaskEffort) : null,
            storyPoint: t.storyPoint || null,
            reporter: (t.reporter as TaskReporter) || "self",
            ownerId: user.id,
            dueDate: t.dueDate ? new Date(t.dueDate) : null,
            tags: t.tags,
            relations: t.relations as unknown as Prisma.InputJsonValue,
            attachments: t.attachments as unknown as Prisma.InputJsonValue,
            deliverables: t.deliverables as unknown as Prisma.InputJsonValue,
            timeSpentSeconds: t.timeSpentSeconds || 0,
            completedAt: t.status === "done" ? new Date() : null, // fallback
          },
        });

        // Insert Comments for this task
        if (t.comments && t.comments.length > 0) {
          await tx.comment.createMany({
            data: t.comments.map((c) => ({
              id: c.id,
              taskId: t.id,
              authorId: user.id,
              content: c.content,
              createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
            })),
          });
        }

        // Insert Status History logs for this task
        if (t.statusHistory && t.statusHistory.length > 0) {
          await tx.taskStatusLog.createMany({
            data: t.statusHistory.map((h) => ({
              id: crypto.randomUUID(),
              taskId: t.id,
              fromStatus: h.fromStatus as TaskStatus | null,
              toStatus: h.toStatus as TaskStatus,
              changedAt: h.changedAt ? new Date(h.changedAt) : new Date(),
            })),
          });
        }
      }

      // 5. Update user stats
      await tx.user.update({
        where: { id: user.id },
        data: {
          bonusXp: bonus.xp,
          bonusCoins: bonus.coins,
          purchasedDecorations: [],
          placedDecorations: {},
        },
      });
    });

    return { success: true, data: { success: true } };
  } catch (error) {
    console.error("Failed to import workspace data:", error);
    return { success: false, error: { code: "INTERNAL", message: "Failed to import workspace data." } };
  }
}
